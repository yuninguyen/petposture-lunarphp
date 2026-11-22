import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { useForm } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ mutate: vi.fn(), success: vi.fn(), error: vi.fn(), seo: { current: null as any }, dirty: { current: false } }));

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, params?: Record<string, string>) => (params ? `${key} ${JSON.stringify(params)}` : key) }) }));
vi.mock('./postsApi', () => ({ useGenerateSeo: () => ({ mutate: mocks.mutate, isPending: false, isError: false }) }));
vi.mock('react-hot-toast', () => ({ default: { success: mocks.success, error: mocks.error } }));
vi.mock('../media/MediaPicker', () => ({ MediaPicker: () => createElement('div') }));

import { SeoSettingsSection } from './SeoSettingsSection';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const answer = { seo_title: 'Raised Dog Bowl | PetPosture', focus_keyphrase: 'raised dog bowl', meta_description: 'A raised bowl that keeps food and water at a comfortable height.', social_title: 'A raised bowl for dogs', social_description: 'See who this raised bowl suits and what to check first.' };

function Harness({ name = 'Necoichi Bowl', extra = false }: { name?: string; extra?: boolean }) {
  const form = useForm({
    defaultValues: {
      attributes: { name, description: '<p>A tilted elevated bowl.</p>', our_take: 'Based on the seller description.', quick_specs: '' },
      seo: { title: '', keyphrase: '', description: '', og_title: '', og_description: '', og_image: null },
    },
  });
  mocks.seo.current = form;
  // Reading it while rendering is what makes react-hook-form track it.
  mocks.dirty.current = form.formState.isDirty;

  return createElement(SeoSettingsSection, {
    control: form.control as any,
    register: form.register as any,
    setValue: form.setValue as any,
    getValues: form.getValues as any,
    titleKey: 'attributes.name',
    contentKey: 'attributes.description',
    extraContent: extra ? [{ label: 'Our take', key: 'attributes.our_take' }, { label: 'Quick specs', key: 'attributes.quick_specs' }] : [],
    mediaContext: 'product',
    contentType: 'product',
  });
}

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const writeText = vi.fn();
const button = (label: string) => Array.from(host.querySelectorAll('button')).find((el) => el.textContent?.includes(label))!;
const type = (value: string) => {
  const box = host.querySelector<HTMLTextAreaElement>('[data-testid="seo-json-input"]')!;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(box, value);
    box.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('SeoSettingsSection without the paid API', () => {
  it('says the Generate with AI button is the paid last resort', () => {
    act(() => root.render(createElement(Harness)));

    expect(host.querySelector('[data-testid="ai-api-fallback-note"]')?.textContent).toBe('posts.seo.api_fallback_note');
    expect(button('posts.seo.generate_ai')).toBeDefined();
  });

  it('copies a prompt built from the name and description, and says so', async () => {
    act(() => root.render(createElement(Harness)));
    await act(async () => { button('posts.seo.copy_prompt').click(); });

    expect(writeText).toHaveBeenCalledTimes(1);
    const prompt = writeText.mock.calls[0][0] as string;
    expect(prompt).toContain('Product name: Necoichi Bowl');
    expect(prompt).toContain('A tilted elevated bowl.');
    expect(prompt).not.toContain('<p>');
    expect(prompt).not.toContain('Our take');
    expect(mocks.success).toHaveBeenCalledWith('posts.seo.copy_prompt_done');
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it('adds the extra fields a Pick passes in', async () => {
    act(() => root.render(createElement(Harness, { extra: true })));
    await act(async () => { button('posts.seo.copy_prompt').click(); });

    const prompt = writeText.mock.calls[0][0] as string;
    expect(prompt).toContain('Our take:\nBased on the seller description.');
    expect(prompt).not.toContain('Quick specs');
  });

  it('asks for a title first instead of copying an empty prompt', async () => {
    act(() => root.render(createElement(Harness, { name: '  ' })));
    await act(async () => { button('posts.seo.copy_prompt').click(); });

    expect(writeText).not.toHaveBeenCalled();
    expect(host.textContent).toContain('posts.seo.add_title_first');
  });

  it('tells the user when the browser refuses to copy', async () => {
    writeText.mockRejectedValue(new Error('blocked'));
    act(() => root.render(createElement(Harness)));
    await act(async () => { button('posts.seo.copy_prompt').click(); });

    expect(mocks.error).toHaveBeenCalledWith('posts.seo.copy_prompt_failed');
  });

  it('fills the five SEO fields from the pasted JSON, marks the form changed, and empties the box', () => {
    act(() => root.render(createElement(Harness)));
    type('```json\n' + JSON.stringify(answer) + '\n```');
    act(() => button('posts.seo.fill_from_json').click());

    const values = mocks.seo.current.getValues('seo');
    expect(values).toMatchObject({ title: answer.seo_title, keyphrase: answer.focus_keyphrase, description: answer.meta_description, og_title: answer.social_title, og_description: answer.social_description });
    expect(mocks.dirty.current).toBe(true);
    expect(host.querySelector('[data-testid="seo-json-message"]')?.textContent).toBe('posts.seo.paste_filled');
    expect(host.querySelector<HTMLTextAreaElement>('[data-testid="seo-json-input"]')!.value).toBe('');
  });

  it('fills nothing and explains when the JSON is wrong', () => {
    act(() => root.render(createElement(Harness)));

    act(() => button('posts.seo.fill_from_json').click());
    expect(host.querySelector('[data-testid="seo-json-message"]')?.textContent).toBe('posts.seo.paste_empty');

    type('not json at all');
    act(() => button('posts.seo.fill_from_json').click());
    expect(host.querySelector('[data-testid="seo-json-message"]')?.textContent).toBe('posts.seo.paste_invalid');

    type(JSON.stringify({ seo_title: 'Only a title' }));
    act(() => button('posts.seo.fill_from_json').click());
    expect(host.querySelector('[data-testid="seo-json-message"]')?.textContent).toContain('posts.seo.paste_missing_keys');
    expect(host.querySelector('[data-testid="seo-json-message"]')?.textContent).toContain('focus_keyphrase');
    expect(mocks.seo.current.getValues('seo.title')).toBe('');
  });

  it('fills but warns when a field is over its limit', () => {
    act(() => root.render(createElement(Harness)));
    type(JSON.stringify({ ...answer, seo_title: 'x'.repeat(70) }));
    act(() => button('posts.seo.fill_from_json').click());

    expect(mocks.seo.current.getValues('seo.title')).toBe('x'.repeat(70));
    expect(host.querySelector('[data-testid="seo-json-message"]')?.textContent).toContain('posts.seo.paste_too_long');
    expect(host.querySelector('[data-testid="seo-json-message"]')?.textContent).toContain('posts.seo.title');
  });
});
