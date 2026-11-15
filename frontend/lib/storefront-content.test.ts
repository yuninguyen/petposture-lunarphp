import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchBlogIndex,
  fetchInsightPosts,
  fetchPicks,
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
  it('keeps only four Picks and asks Next to revalidate them', async () => {
    vi.stubEnv('INTERNAL_API_URL', 'http://127.0.0.1:8001');
    const fetchMock = stubFetch({
      '/api/products?per_page=100': { body: { data: [1, 2, 3, 4, 5, 6].map((id) => ({ id, pick: { goUrl: `/go/${id}` } })) } },
    });

    const products = await fetchPicks();

    expect(products).toHaveLength(4);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8001/api/products?per_page=100',
      { next: { revalidate: 300 } },
    );
  });

  it('leaves out products that are not Picks, and a Pick with no stock is still a Pick', async () => {
    stubFetch({
      '/api/products?per_page=100': {
        body: {
          data: [
            { id: 1, name: 'Ordinary product', pick: null },
            { id: 2, name: 'No pick key at all' },
            { id: 3, name: 'Pick with stock 0', available: false, stockStatus: 'out_of_stock', pick: { goUrl: '/go/3' } },
          ],
        },
      },
    });

    const products = await fetchPicks();

    expect(products?.map((product) => product.id)).toEqual([3]);
  });

  it('returns an empty list, not null, when no product is a Pick yet', async () => {
    stubFetch({ '/api/products?per_page=100': { body: { data: [{ id: 1, pick: null }] } } });

    expect(await fetchPicks()).toEqual([]);
  });

  it('returns null when the API answers with an error status', async () => {
    stubFetch({ '/api/posts': { ok: false, body: '<html>Just a moment...</html>' } });

    expect(await fetchInsightPosts()).toBeNull();
  });

  it('returns null when the request throws', async () => {
    stubFetch({ '/api/products?per_page=100': new Error('boom') });

    expect(await fetchPicks()).toBeNull();
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
