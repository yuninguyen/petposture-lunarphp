import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('./postsApi', () => ({ useGenerateSeo: () => ({ mutate: mocks.mutate, isPending: false, isError: false }) }));
vi.mock('../media/MediaPicker', () => ({ MediaPicker: ({ context, value }: { context: string; value: { url: string } | null }) => createElement('div', { 'data-testid': 'media-picker', 'data-context': context, 'data-value': value?.url ?? '' }) }));

import { SeoSettingsSection } from './SeoSettingsSection';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function ProductSeoHarness() {
  const form = useForm({
    defaultValues: {
      attributes: { name: 'Posture Bowl', description: '<p>Raised ceramic bowl.</p>' },
      seo: { title: 'Raised Posture Bowl | PetPosture', keyphrase: '', description: 'A comfortable raised ceramic bowl for cats and dogs.', og_title: 'Posture Bowl for Cats', og_description: 'A comfortable raised ceramic bowl.', og_image: 'https://cdn.example.com/posture-bowl.jpg' },
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
    googlePreviewImage: 'https://cdn.example.com/product-main.jpg',
    googlePreviewPath: 'shop/posture-bowl',
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
    googlePreviewImage: 'https://cdn.example.com/dog-ramp.jpg',
    googlePreviewPath: 'blog/dog-ramp-guide',
  });
}

describe('SeoSettingsSection shared contexts', () => {
  it('keeps blog as the default AI and media context', () => {
    mocks.mutate.mockClear();
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(createElement(BlogSeoHarness)));

    expect(host.querySelector('[data-testid="google-preview-image"]')?.getAttribute('src')).toBe('https://cdn.example.com/dog-ramp.jpg');
    expect(host.querySelector('[data-testid="google-preview-url"]')?.textContent).toContain('petposture.com › blog › dog-ramp-guide');

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
    expect(host.querySelector('[data-testid="google-preview-title"]')?.textContent).toContain('Raised Posture Bowl | PetPosture');
    expect(host.querySelector('[data-testid="google-preview-description"]')?.textContent).toContain('A comfortable raised ceramic bowl for cats and dogs.');
    expect(host.querySelector('[data-testid="google-preview-site-name"]')?.textContent).toBe('PetPosture');
    expect(host.querySelector('[data-testid="google-preview-url"]')?.textContent).toContain('petposture.com › shop › posture-bowl');
    const googleImage = host.querySelector('[data-testid="google-preview-image"]')!;
    const googleDescription = host.querySelector('[data-testid="google-preview-description"]')!;
    expect(googleImage.getAttribute('src')).toBe('https://cdn.example.com/product-main.jpg');
    expect(googleDescription.compareDocumentPosition(googleImage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const social = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'posts.seo.subsection_social')!;
    act(() => social.click());
    expect(host.querySelector('[data-testid="media-picker"]')?.getAttribute('data-context')).toBe('product');
    expect(host.querySelector('[data-testid="social-preview-image"]')?.getAttribute('src')).toBe('https://cdn.example.com/posture-bowl.jpg');
    expect(host.querySelector('[data-testid="social-preview"]')?.textContent).toContain('Posture Bowl for Cats');
    expect(host.querySelector('[data-testid="social-preview"]')?.textContent).toContain('A comfortable raised ceramic bowl.');

    act(() => root.unmount());
    host.remove();
  });
});
