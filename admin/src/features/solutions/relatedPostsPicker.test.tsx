import { act, createElement, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ fetchJson: vi.fn() }));

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<object>()), fetchJson: mocks.fetchJson }));
vi.mock('@tiptap/react', () => ({ useEditor: () => null, EditorContent: () => null }));
vi.mock('@/features/media/MediaPicker', () => ({ MediaPicker: () => null }));
vi.mock('../posts/SeoSettingsSection', () => ({ SeoSettingsSection: () => null }));

import { SolutionFormPage } from './SolutionFormPage';
import { BreedFormPage } from '../breeds/BreedFormPage';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// The shapes the API really sends: the posts list (PostResource) has string ids,
// while the posts saved on a Solution or Breed are plain models with number ids.
const ALL_POSTS = [{ id: '4', title: 'Post four' }, { id: '5', title: 'Post five' }, { id: '13', title: 'Post thirteen' }];
const RECORD = { id: 1, name: 'Mobility', slug: 'mobility', description: '', products: [], posts: [{ id: 4, title: 'Post four' }, { id: 5, title: 'Post five' }] };

let host: HTMLDivElement;
let root: Root;

const flush = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
const box = (title: string) => [...host.querySelectorAll('label')].find((label) => label.textContent === title)!.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
const ticked = () => ALL_POSTS.map((post) => box(post.title).checked);
const savedBody = () => mocks.fetchJson.mock.calls.find(([, options]) => options?.method === 'PUT')?.[1].body;

async function mount(path: string, Page: ComponentType) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  act(() => root.render(
    createElement(QueryClientProvider, { client },
      createElement(MemoryRouter, { initialEntries: [`/${path}/1`] },
        createElement(Routes, null,
          createElement(Route, { path: `/${path}/:id`, element: createElement(Page) }),
          createElement(Route, { path: `/${path}`, element: createElement('p') })))),
  ));
  for (let i = 0; i < 4; i++) await flush();
}

async function save() {
  const button = [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'common.save')!;
  await act(async () => { button.click(); });
  for (let i = 0; i < 3; i++) await flush();
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  mocks.fetchJson.mockReset();
  mocks.fetchJson.mockImplementation((url: string) => {
    if (url.startsWith('/admin/posts')) return Promise.resolve({ data: ALL_POSTS });
    if (url.startsWith('/products')) return Promise.resolve({ data: [] });
    return Promise.resolve({ data: RECORD });
  });
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe.each([
  ['Solution', 'solutions', SolutionFormPage],
  ['Breed', 'breeds', BreedFormPage],
])('%s form, Posts picker', (_name, path, Page) => {
  it('opens with the saved posts ticked', async () => {
    await mount(path, Page);

    expect(ticked()).toEqual([true, true, false]);
    expect(host.textContent).toContain('2 selected');
  });

  it('unticks a saved post and adds another, and saves exactly those ids as numbers', async () => {
    await mount(path, Page);

    act(() => box('Post four').click());
    act(() => box('Post thirteen').click());
    expect(ticked()).toEqual([false, true, true]);
    expect(host.textContent).toContain('2 selected');

    await save();
    expect(savedBody().post_ids).toEqual([5, 13]);
  });
});
