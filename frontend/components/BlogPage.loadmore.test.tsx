// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BlogPage from './BlogPage';

vi.mock('@/components/Header', () => ({ default: () => null }));
vi.mock('@/components/Footer', () => ({ default: () => null }));
vi.mock('@/context/SettingsContext', () => ({ useSettings: () => ({ social: {} }) }));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const post = (id: number, title: string) => ({
    id: String(id), slug: `post-${id}`, title, content: 'Body text of the post.', created_at: '2026-11-10T00:00:00Z', published_at: '2026-11-10T00:00:00Z',
    featured_image: null, featured_image_alt: null, blog_category: { id: '1', name: 'Guides', slug: 'guides' },
});

const firstPage = [post(1, 'Featured story'), post(2, 'Second story')];

let root: Root | null = null;
let host: HTMLElement | null = null;

function render(lastPage: number) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root!.render(<BlogPage initialData={{ posts: firstPage, categories: [], lastPage } as never} />));
    return host;
}

const loadMoreButton = () => [...document.querySelectorAll('button')].find((button) => /Load More|Loading/.test(button.textContent ?? ''));

async function click(button: Element) {
    await act(async () => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
}

afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    root = null;
    host = null;
    vi.unstubAllGlobals();
});

describe('BlogPage Load More Content', () => {
    it('is not shown when every post is already on the page', () => {
        render(1);

        expect(loadMoreButton()).toBeUndefined();
    });

    it('fetches the next page and adds its posts, then hides itself on the last page', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [post(2, 'Second story'), post(3, 'Third story')], meta: { last_page: 2 } }) });
        vi.stubGlobal('fetch', fetchMock);
        render(2);
        const secondBefore = document.body.textContent?.match(/Second story/g)?.length;

        await click(loadMoreButton()!);

        expect(String(fetchMock.mock.calls[0][0])).toContain('/api/posts?page=2');
        expect(document.body.textContent).toContain('Third story');
        // A post that came back on both pages is not added a second time.
        expect(document.body.textContent?.match(/Second story/g)?.length).toBe(secondBefore);
        expect(loadMoreButton()).toBeUndefined();
    });

    it('says so and keeps the button when the next page could not be loaded', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
        render(2);

        await click(loadMoreButton()!);

        expect(document.querySelector('[role="alert"]')?.textContent).toContain('could not load more');
        expect(loadMoreButton()?.textContent).toContain('Load More Content');
    });
});
