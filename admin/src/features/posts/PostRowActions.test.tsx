import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ fetchJson: vi.fn(), toastError: vi.fn() }));

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-hot-toast', () => ({ default: { error: mocks.toastError } }));
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<object>()), fetchJson: mocks.fetchJson }));

import { PostRowActions } from './PostRowActions';
import type { Post } from './postsApi';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PREVIEW = 'https://storefront.test/blog/my-post?expires=1&signature=abc';

let host: HTMLDivElement;
let root: Root;
let opened: Array<{ href: string; target: string; rel: string }>;
let previewResponse: () => Promise<unknown>;

const flush = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

async function mount(status: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const post = { id: 13, slug: 'my-post', title: 'My post', status } as unknown as Post;
  act(() => root.render(
    createElement(QueryClientProvider, { client },
      createElement(MemoryRouter, null, createElement(PostRowActions, { post, onDuplicate: () => {}, onDelete: () => {} }))),
  ));
  await flush();
}

const previewButton = () => host.querySelector<HTMLButtonElement>('button[title="posts.form_button_preview"]');
const liveLink = () => host.querySelector<HTMLAnchorElement>('a[title="posts.action_view"]');
const previewCalls = () => mocks.fetchJson.mock.calls.filter(([url]) => String(url).includes('preview-url'));

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  opened = [];
  previewResponse = () => Promise.resolve({ url: PREVIEW });
  mocks.fetchJson.mockReset();
  mocks.toastError.mockReset();
  mocks.fetchJson.mockImplementation((url: string) =>
    // /settings answers late on purpose: the View link must still end up on the right storefront.
    url === '/settings' ? new Promise((resolve) => setTimeout(() => resolve({ data: { frontend_url: 'https://storefront.test' } }), 20)) : previewResponse());
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    opened.push({ href: this.href, target: this.target, rel: this.rel });
  });
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

describe('PostRowActions view and preview', () => {
  it('links a published post to its live page and asks for no preview link', async () => {
    await mount('published');

    // React only redraws once an act() step ends, so wait in short steps for the late /settings answer.
    for (let i = 0; i < 100 && !liveLink()?.href.startsWith('https://storefront.test'); i++) await flush();
    expect(liveLink()?.getAttribute('href')).toBe('https://storefront.test/blog/my-post');
    expect(previewButton()).toBeNull();
    expect(previewCalls()).toHaveLength(0);
  });

  it.each(['draft', 'scheduled'])('opens the signed preview of a %s post in a new tab, only once it is asked for', async (status) => {
    await mount(status);

    expect(liveLink()).toBeNull();
    expect(previewCalls()).toHaveLength(0);

    act(() => previewButton()!.click());
    await flush();

    expect(previewCalls()).toEqual([['/admin/posts/13/preview-url']]);
    expect(opened).toEqual([{ href: PREVIEW, target: '_blank', rel: 'noopener noreferrer' }]);
    expect(document.querySelector('a[href*="signature"]')).toBeNull();
  });

  it('cannot be pressed twice while the link is on its way', async () => {
    let finish: (value: unknown) => void = () => {};
    previewResponse = () => new Promise((resolve) => { finish = resolve; });
    await mount('draft');

    act(() => previewButton()!.click());
    await flush();
    expect(previewButton()!.disabled).toBe(true);

    await act(async () => { finish({ url: PREVIEW }); });
    await flush();
    expect(previewButton()!.disabled).toBe(false);
    expect(opened).toHaveLength(1);
  });

  it('says so and opens nothing when the link cannot be made', async () => {
    previewResponse = () => Promise.reject(new Error('boom'));
    await mount('draft');

    act(() => previewButton()!.click());
    await flush();

    expect(mocks.toastError).toHaveBeenCalledWith('posts.preview_error');
    expect(opened).toHaveLength(0);
  });
});
