import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchBestSellers,
  fetchBlogIndex,
  fetchInsightPosts,
  toInsightPost,
} from './storefront-content';

function stubFetch(responses: Record<string, { ok?: boolean; body?: unknown } | Error>) {
  const fetchMock = vi.fn(async (url: string) => {
    const entry = Object.entries(responses).find(([path]) => url.endsWith(path));
    if (!entry) throw new Error(`unexpected fetch ${url}`);
    const [, value] = entry;
    if (value instanceof Error) throw value;
    return { ok: value.ok ?? true, json: async () => value.body };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('storefront content fetchers', () => {
  it('keeps only four best sellers and asks Next to revalidate them', async () => {
    vi.stubEnv('INTERNAL_API_URL', 'http://127.0.0.1:8001');
    const fetchMock = stubFetch({
      '/api/products?category=best-sellers': { body: { data: [1, 2, 3, 4, 5, 6].map((id) => ({ id })) } },
    });

    const products = await fetchBestSellers();

    expect(products).toHaveLength(4);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8001/api/products?category=best-sellers',
      { next: { revalidate: 300 } },
    );
  });

  it('returns null when the API answers with an error status', async () => {
    stubFetch({ '/api/posts': { ok: false, body: '<html>Just a moment...</html>' } });

    expect(await fetchInsightPosts()).toBeNull();
  });

  it('returns null when the request throws', async () => {
    stubFetch({ '/api/products?category=best-sellers': new Error('boom') });

    expect(await fetchBestSellers()).toBeNull();
  });

  it('returns null when the payload has no data array', async () => {
    stubFetch({ '/api/posts': { body: { message: 'oops' } } });

    expect(await fetchInsightPosts()).toBeNull();
  });

  it('maps only the three newest posts to the small homepage shape', async () => {
    stubFetch({
      '/api/posts': {
        body: {
          data: [1, 2, 3, 4].map((n) => ({
            slug: `post-${n}`,
            title: `Post ${n}`,
            content: '<p>Hello <b>world</b></p>',
            published_at: '2026-10-09T12:00:00Z',
            blog_category: { name: 'Breed Guides' },
          })),
        },
      },
    });

    const posts = await fetchInsightPosts();

    expect(posts).toHaveLength(3);
    expect(posts?.[0]).toMatchObject({ slug: 'post-1', cat: 'Breed Guides', excerpt: 'Hello world', img: null });
  });

  it('falls back to defaults for a post without category or read time', () => {
    const post = toInsightPost({ slug: 'a', title: 'A', published_at: '2026-10-09T12:00:00Z' });

    expect(post.cat).toBe('Insights');
    expect(post.readTime).toBe('5 min read');
  });

  it('trims blog post content to an excerpt source instead of the whole article', async () => {
    stubFetch({
      '/api/posts': { body: { data: [{ id: '1', slug: 'a', title: 'A', content: `<p>${'word '.repeat(500)}</p>` }] } },
      '/api/blog/categories': { body: { data: [{ id: 2, name: 'PetPosture', slug: 'petposture' }] } },
    });

    const index = await fetchBlogIndex();

    expect(index?.posts[0].content.length).toBe(200);
    expect(index?.categories).toHaveLength(1);
  });

  it('returns null for the blog index when either request fails', async () => {
    stubFetch({
      '/api/posts': { body: { data: [] } },
      '/api/blog/categories': { ok: false },
    });

    expect(await fetchBlogIndex()).toBeNull();
  });
});
