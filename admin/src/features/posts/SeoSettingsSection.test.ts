import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('./postsApi', () => ({ useGenerateSeo: () => ({ mutate: mocks.mutate, isPending: false, isError: false }) }));
vi.mock('../media/MediaPicker', () => ({ MediaPicker: ({ context }: { context: string }) => createElement('div', { 'data-testid': 'media-picker', 'data-context': context }) }));

import { SeoSettingsSection } from './SeoSettingsSection';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function ProductSeoHarness() {
  const form = useForm({
    defaultValues: {
      attributes: { name: 'Posture Bowl', description: '<p>Raised ceramic bowl.</p>' },
      seo: { title: '', keyphrase: '', description: '', og_title: '', og_description: '', og_image: null },
    },
  });

  return createElement(SeoSettingsSection, {
    control: form.control as any,
    register: form.register as any,
    setValue: form.setValue as any,
    getValues: form.getValues as any,
    titleKey: 'attributes.name',
    contentKey: 'attributes.description',
    mediaContext: 'product',
    contentType: 'product',
  });
}

function BlogSeoHarness() {
  const form = useForm({
    defaultValues: {
      title: 'Dog Ramp Guide', content: '<p>How to choose a ramp.</p>',
      seo: { title: '', keyphrase: '', description: '', og_title: '', og_description: '', og_image: null },
    },
  });

  return createElement(SeoSettingsSection, {
    control: form.control as any,
    register: form.register as any,
    setValue: form.setValue as any,
    getValues: form.getValues as any,
  });
}

describe('SeoSettingsSection shared contexts', () => {
  it('keeps blog as the default AI and media context', () => {
    mocks.mutate.mockClear();
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(createElement(BlogSeoHarness)));

    const generate = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'posts.seo.generate_ai')!;
    act(() => generate.click());
    expect(mocks.mutate).toHaveBeenCalledWith(
      { title: 'Dog Ramp Guide', content: '<p>How to choose a ramp.</p>', content_type: 'blog' },
      expect.any(Object),
    );

    const social = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'posts.seo.subsection_social')!;
    act(() => social.click());
    expect(host.querySelector('[data-testid="media-picker"]')?.getAttribute('data-context')).toBe('blog');

    act(() => root.unmount());
    host.remove();
  });

  it('sends product content type to AI and product context to media picker', () => {
    mocks.mutate.mockClear();
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(createElement(ProductSeoHarness)));

    const generate = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'posts.seo.generate_ai')!;
    act(() => generate.click());
    expect(mocks.mutate).toHaveBeenCalledWith(
      { title: 'Posture Bowl', content: '<p>Raised ceramic bowl.</p>', content_type: 'product' },
      expect.any(Object),
    );

    const social = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'posts.seo.subsection_social')!;
    act(() => social.click());
    expect(host.querySelector('[data-testid="media-picker"]')?.getAttribute('data-context')).toBe('product');

    act(() => root.unmount());
    host.remove();
  });
});
