import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  generateSeo: vi.fn(),
  navigate: vi.fn(),
  toastError: vi.fn(),
  editorOnUpdate: undefined as undefined | ((args: { editor: { getHTML: () => string } }) => void),
}));

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mocks.navigate, useParams: () => ({}) };
});
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return { ...actual, useQueryClient: () => ({ invalidateQueries: vi.fn() }) };
});
vi.mock('react-hot-toast', () => ({ default: { error: mocks.toastError, success: vi.fn() } }));
vi.mock('./api', () => ({
  usePage: () => ({ data: undefined }),
  useCreatePage: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useUpdatePage: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useDeletePage: () => ({ isPending: false, mutate: vi.fn() }),
}));
vi.mock('@/features/posts/postsApi', () => ({
  useGenerateSeo: () => ({ isPending: false, mutate: mocks.generateSeo }),
}));
vi.mock('@/features/posts/TipTapToolbar', () => ({ TipTapToolbar: () => createElement('div') }));
vi.mock('@tiptap/react', () => ({
  EditorContent: () => createElement('div'),
  useEditor: (options: { onUpdate: (args: { editor: { getHTML: () => string } }) => void }) => {
    mocks.editorOnUpdate = options.onUpdate;
    return { getHTML: () => '<p>Page content</p>', commands: { setContent: vi.fn() } };
  },
}));

import { PageFormPage } from './PageFormPage';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function changeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(element.constructor.prototype, 'value')?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('PageFormPage AI SEO', () => {
  beforeEach(() => {
    mocks.generateSeo.mockReset();
    mocks.toastError.mockReset();
  });

  it('fills only the light-touch Page meta fields from the existing blog AI endpoint', () => {
    mocks.generateSeo.mockImplementation((payload, options) => {
      options.onSuccess({
        seo_title: 'Generated Page Title',
        focus_keyphrase: 'ignored',
        meta_description: 'Generated page description',
        social_title: 'ignored',
        social_description: 'ignored',
      });
    });

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(createElement(PageFormPage)));

    act(() => changeValue(host.querySelector('input[name="title"]')!, 'Shipping Policy'));
    act(() => mocks.editorOnUpdate?.({ editor: { getHTML: () => '<p>Shipping details</p>' } }));

    const generateButton = Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.includes('posts.seo.generate_ai'))!;
    expect(generateButton.className).toContain('bg-white');
    act(() => generateButton.click());

    expect(mocks.generateSeo).toHaveBeenCalledWith(
      { title: 'Shipping Policy', content: '<p>Shipping details</p>', content_type: 'blog' },
      expect.any(Object),
    );
    expect((host.querySelector('input[name="meta_title"]') as HTMLInputElement).value).toBe('Generated Page Title');
    expect((host.querySelector('textarea[name="meta_description"]') as HTMLTextAreaElement).value).toBe('Generated page description');

    act(() => root.unmount());
    host.remove();
  });

  it('updates the Google preview in real time and warns when text exceeds its limits', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(createElement(PageFormPage)));

    const longTitle = 'T'.repeat(61);
    const longDescription = 'D'.repeat(161);
    act(() => changeValue(host.querySelector('input[name="title"]')!, 'Fallback Page Title'));
    act(() => changeValue(host.querySelector('input[name="slug"]')!, 'shipping-policy'));
    act(() => changeValue(host.querySelector('input[name="meta_title"]')!, longTitle));
    act(() => changeValue(host.querySelector('textarea[name="meta_description"]')!, longDescription));

    expect(host.querySelector('[data-testid="page-preview-url"]')?.textContent).toBe('petposture.com/shipping-policy');
    expect(host.querySelector('[data-testid="page-preview-title"]')?.textContent).toBe(`${'T'.repeat(60)}…`);
    expect(host.querySelector('[data-testid="page-preview-description"]')?.textContent).toBe(`${'D'.repeat(160)}…`);
    expect(host.querySelector('[data-testid="page-preview-title-count"]')?.className).toContain('text-red-600');
    expect(host.querySelector('[data-testid="page-preview-description-count"]')?.className).toContain('text-red-600');
    expect(mocks.generateSeo).not.toHaveBeenCalled();

    act(() => changeValue(host.querySelector('input[name="meta_title"]')!, ''));
    expect(host.querySelector('[data-testid="page-preview-title"]')?.textContent).toBe('Fallback Page Title');

    act(() => root.unmount());
    host.remove();
  });
});
