import { act, createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../locales/en.json';

const mocks = vi.hoisted(() => ({
  fetchAiSettings: vi.fn(),
  fetchAiModels: vi.fn(),
  updateAiSettings: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => en[key as keyof typeof en] ?? key,
  }),
}));

vi.mock('./api', async (importOriginal) => ({
  ...await importOriginal<typeof import('./api')>(),
  ...mocks,
}));

import { AiSettingsForm } from './AiSettingsForm';
import type { AiSettingsState } from './api';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ai: AiSettingsState = {
  configured: true,
  source: 'database',
  fields: {
    ai_seo_provider: { value: 'auto', configured: true, source: 'database', hint: 'Stored provider' },
    anthropic_api_key: { configured: true, source: 'database', hint: 'Stored Anthropic key' },
    anthropic_model: { value: 'claude-stored', configured: true, source: 'database', hint: 'Stored Anthropic model' },
    openai_api_key: { configured: true, source: 'database', hint: 'Stored OpenAI key' },
    openai_model: { value: 'gpt-stored', configured: true, source: 'database', hint: 'Stored OpenAI model' },
    openai_base_url: { value: 'https://openai.stored/v1', configured: true, source: 'database', hint: 'Stored OpenAI URL' },
    xai_api_key: { configured: true, source: 'database', hint: 'Stored xAI key' },
    xai_model: { value: 'grok-stored', configured: true, source: 'database', hint: 'Stored xAI model' },
    gemini_api_key: { configured: true, source: 'database', hint: 'Stored Gemini key' },
    gemini_model: { value: 'gemini-stored', configured: true, source: 'database', hint: 'Stored Gemini model' },
  },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((next, fail) => { resolve = next; reject = fail; });
  return { promise, resolve, reject };
}

async function flush() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}

async function renderForm(queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
})) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(createElement(QueryClientProvider, { client: queryClient }, createElement(AiSettingsForm))));
  await flush();
  return { host, root, queryClient };
}

function field(host: HTMLElement, key: string) {
  return host.querySelector<HTMLInputElement | HTMLSelectElement>(`#ai-${key}`)!;
}

function button(host: HTMLElement, text: string) {
  return Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((candidate) => candidate.textContent === text)!;
}

function setValue(element: HTMLInputElement | HTMLSelectElement, value: string) {
  act(() => {
    const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value);
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function click(element: HTMLElement) {
  await act(async () => element.click());
}

function cleanup(rendered: Awaited<ReturnType<typeof renderForm>>) {
  act(() => rendered.root.unmount());
  rendered.host.remove();
  rendered.queryClient.clear();
}

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  mocks.fetchAiSettings.mockResolvedValue({ data: ai });
  mocks.fetchAiModels.mockResolvedValue({ data: { status: 'loaded', models: ['gpt-z', 'gpt-stored', 'gpt-a'] } });
  mocks.updateAiSettings.mockResolvedValue({ data: ai });
});

describe('AiSettingsForm', () => {
  it('renders exactly ten fields, keeps four secrets blank, and offers grok as a provider', async () => {
    const rendered = await renderForm();
    const keys = ['ai_seo_provider', 'anthropic_api_key', 'anthropic_model', 'openai_api_key', 'openai_model', 'openai_base_url', 'xai_api_key', 'xai_model', 'gemini_api_key', 'gemini_model'];
    expect(keys.map((key) => field(rendered.host, key))).toHaveLength(10);
    for (const key of ['anthropic_api_key', 'openai_api_key', 'xai_api_key', 'gemini_api_key']) {
      expect(field(rendered.host, key)).toHaveValue('');
    }
    expect(field(rendered.host, 'anthropic_model')).toHaveValue('claude-stored');
    expect(Array.from((field(rendered.host, 'ai_seo_provider') as HTMLSelectElement).options).map((option) => option.value)).toEqual(['auto', 'anthropic', 'openai', 'grok', 'gemini']);
    expect(rendered.host.textContent).toContain('Configured in database.');
    expect(rendered.host.textContent).not.toContain('Stored provider');
    expect(rendered.host.textContent).not.toContain('Stored Anthropic model');
    expect(rendered.host.textContent).not.toContain('Stored OpenAI model');
    expect(rendered.host.textContent).not.toContain('Stored OpenAI URL');
    expect(rendered.host.textContent).not.toContain('Stored xAI model');
    expect(rendered.host.textContent).not.toContain('Stored Gemini model');
    expect(rendered.host.textContent).not.toMatch(/\*{3,}|•{3,}/);
    cleanup(rendered);
  });

  it.each([
    ['openai_api_key', 'candidate-key'],
    ['openai_base_url', 'https://changed.test/v1'],
  ])('gates an OpenAI %s change on the latest successful fetch', async (key, value) => {
    const rendered = await renderForm();
    setValue(field(rendered.host, key), value);
    expect(button(rendered.host, 'Save')).toBeDisabled();
    await click(button(rendered.host, 'Fetch models'));
    expect(button(rendered.host, 'Save')).toBeEnabled();
    setValue(field(rendered.host, key), `${value}-again`);
    expect(button(rendered.host, 'Save')).toBeDisabled();
    cleanup(rendered);
  });

  it.each([
    ['ai_seo_provider', 'grok'],
    ['anthropic_api_key', 'anthropic-candidate'],
    ['anthropic_model', 'claude-new'],
    ['xai_api_key', 'xai-candidate'],
    ['xai_model', 'grok-new'],
    ['gemini_api_key', 'gemini-candidate'],
    ['gemini_model', 'gemini-new'],
  ])('allows a non-OpenAI %s change to save without fetching', async (key, value) => {
    const rendered = await renderForm();
    setValue(field(rendered.host, key), value);
    expect(button(rendered.host, 'Save')).toBeEnabled();
    await click(button(rendered.host, 'Save'));
    expect(mocks.fetchAiModels).not.toHaveBeenCalled();
    expect(mocks.updateAiSettings).toHaveBeenCalledTimes(1);
    cleanup(rendered);
  });

  it.each(['openai_api_key', 'openai_base_url', 'openai_model'])('sends %s clear intent to the server and treats a successful fetch as validation', async (key) => {
    const rendered = await renderForm();
    const input = field(rendered.host, key);
    await click(input.closest('.space-y-2')!.querySelector<HTMLElement>('[data-action="remove-override"]')!);
    expect(input).toBeDisabled();
    expect(button(rendered.host, 'Save')).toBeDisabled();
    await click(button(rendered.host, 'Fetch models'));
    expect(mocks.fetchAiModels).toHaveBeenCalledWith({ clear_fields: [key] });
    expect(button(rendered.host, 'Save')).toBeEnabled();
    cleanup(rendered);
  });

  it.each(['openai_api_key', 'openai_base_url', 'openai_model'])('undoing an OpenAI %s clear removes the obsolete change and authorization', async (key) => {
    const rendered = await renderForm();
    const input = field(rendered.host, key);
    await click(input.closest('.space-y-2')!.querySelector<HTMLElement>('[data-action="remove-override"]')!);
    await click(button(rendered.host, 'Fetch models'));
    await click(input.closest('.space-y-2')!.querySelector<HTMLElement>('[data-action="undo-remove-override"]')!);
    expect(button(rendered.host, 'Save')).toBeDisabled();
    expect(input).toBeEnabled();
    cleanup(rendered);
  });

  it.each([
    ['openai_base_url', 'https://changed.test/v1', 'https://openai.stored/v1'],
    ['openai_model', 'gpt-a', 'gpt-stored'],
  ])('ordinary %s edits reverted to baseline remove the obsolete gate', async (key, changed, original) => {
    const rendered = await renderForm();
    setValue(field(rendered.host, key), changed);
    expect(button(rendered.host, 'Save')).toBeDisabled();
    setValue(field(rendered.host, key), original);
    expect(button(rendered.host, 'Save')).toBeDisabled();
    expect(mocks.fetchAiModels).not.toHaveBeenCalled();
    cleanup(rendered);
  });

  it('requires a non-empty effective OpenAI model to belong to the latest sorted model list', async () => {
    mocks.fetchAiModels.mockResolvedValueOnce({ data: { status: 'loaded', models: ['gpt-z', 'gpt-a', 'gpt-a'] } });
    const rendered = await renderForm();
    setValue(field(rendered.host, 'openai_base_url'), 'https://changed.test/v1');
    await click(button(rendered.host, 'Fetch models'));
    expect(rendered.host.textContent).toContain('Choose an OpenAI model returned by the latest fetch.');
    expect(button(rendered.host, 'Save')).toBeDisabled();
    expect(Array.from((field(rendered.host, 'openai_model') as HTMLSelectElement).options).map((option) => option.value)).toEqual(['gpt-a', 'gpt-stored', 'gpt-z']);
    setValue(field(rendered.host, 'openai_model'), 'gpt-a');
    expect(button(rendered.host, 'Save')).toBeEnabled();
    cleanup(rendered);
  });

  it('keeps Save enabled when selecting a model from a successful fetch', async () => {
    const rendered = await renderForm();
    setValue(field(rendered.host, 'openai_base_url'), 'https://changed.test/v1');
    await click(button(rendered.host, 'Fetch models'));
    expect(button(rendered.host, 'Save')).toBeEnabled();

    setValue(field(rendered.host, 'openai_model'), 'gpt-a');

    expect(button(rendered.host, 'Save')).toBeEnabled();
    cleanup(rendered);
  });

  it('keeps candidates out of both TanStack caches, storage, URL, model options, status, and errors', async () => {
    const sentinel = 'OPENAI-SUPER-SECRET-SENTINEL';
    const rendered = await renderForm();
    setValue(field(rendered.host, 'openai_api_key'), sentinel);
    await click(button(rendered.host, 'Fetch models'));
    expect(mocks.fetchAiModels).toHaveBeenCalledWith({ fields: { openai_api_key: sentinel } });
    expect(JSON.stringify(rendered.queryClient.getQueryCache().getAll().map((query) => query.state.data))).not.toContain(sentinel);
    expect(JSON.stringify(rendered.queryClient.getMutationCache().getAll().map((mutation) => mutation.state.variables))).not.toContain(sentinel);
    expect(JSON.stringify(localStorage)).not.toContain(sentinel);
    expect(JSON.stringify(sessionStorage)).not.toContain(sentinel);
    expect(window.location.href).not.toContain(sentinel);
    expect(Array.from((field(rendered.host, 'openai_model') as HTMLSelectElement).options).map((option) => option.textContent)).not.toContain(sentinel);
    await click(button(rendered.host, 'Save'));
    await flush();
    expect(mocks.updateAiSettings).toHaveBeenCalledWith({ fields: { openai_api_key: sentinel } });
    expect(field(rendered.host, 'openai_api_key')).toHaveValue('');
    expect(rendered.host.textContent).not.toContain(sentinel);
    cleanup(rendered);
  });

  it('uses sanitized models from a 422 response to recover from a stale effective model', async () => {
    mocks.fetchAiModels.mockRejectedValueOnce(Object.assign(new Error('RAW-PROVIDER-SECRET'), {
      status: 422,
      data: { data: { status: 'invalid', models: ['gpt-z', 'gpt-a'] } },
    }));
    const rendered = await renderForm();
    setValue(field(rendered.host, 'openai_base_url'), 'https://changed.test/v1');

    await click(button(rendered.host, 'Fetch models'));
    await flush();

    expect(Array.from((field(rendered.host, 'openai_model') as HTMLSelectElement).options).map((option) => option.value)).toEqual(['gpt-a', 'gpt-stored', 'gpt-z']);
    expect(rendered.host.textContent).toContain('Choose an OpenAI model returned by the latest fetch.');
    expect(rendered.host.textContent).not.toContain('RAW-PROVIDER-SECRET');
    expect(button(rendered.host, 'Save')).toBeDisabled();

    setValue(field(rendered.host, 'openai_model'), 'gpt-a');
    expect(button(rendered.host, 'Save')).toBeDisabled();
    await click(button(rendered.host, 'Fetch models'));
    expect(button(rendered.host, 'Save')).toBeEnabled();
    cleanup(rendered);
  });

  it.each([
    [422, 'OpenAI rejected these settings.'],
    [502, 'OpenAI models could not be loaded. Try again.'],
  ])('maps fetch status %s to controlled copy without raw provider detail', async (status, safeCopy) => {
    mocks.fetchAiModels.mockRejectedValueOnce(Object.assign(new Error('RAW-PROVIDER-SECRET'), { status }));
    const rendered = await renderForm();
    setValue(field(rendered.host, 'openai_api_key'), 'candidate');
    await click(button(rendered.host, 'Fetch models'));
    await flush();
    expect(rendered.host.querySelector('[role="alert"]')).toHaveTextContent(safeCopy);
    expect(rendered.host.textContent).not.toContain('RAW-PROVIDER-SECRET');
    expect(button(rendered.host, 'Save')).toBeDisabled();
    cleanup(rendered);
  });

  it('locks duplicate fetches and saves, and ignores an obsolete fetch response', async () => {
    const first = deferred<{ data: { status: 'loaded'; models: string[] } }>();
    const savePending = deferred<{ data: AiSettingsState }>();
    mocks.fetchAiModels.mockReturnValueOnce(first.promise);
    mocks.updateAiSettings.mockReturnValueOnce(savePending.promise);
    const rendered = await renderForm();
    setValue(field(rendered.host, 'openai_api_key'), 'first-key');
    const fetchButton = button(rendered.host, 'Fetch models');
    await act(async () => { fetchButton.click(); fetchButton.click(); });
    expect(mocks.fetchAiModels).toHaveBeenCalledTimes(1);
    setValue(field(rendered.host, 'openai_api_key'), 'second-key');
    await act(async () => first.resolve({ data: { status: 'loaded', models: ['gpt-stored'] } }));
    await flush();
    expect(button(rendered.host, 'Save')).toBeDisabled();

    await click(button(rendered.host, 'Fetch models'));
    const save = button(rendered.host, 'Save');
    await act(async () => { save.click(); save.click(); });
    expect(mocks.updateAiSettings).toHaveBeenCalledTimes(1);
    await act(async () => savePending.resolve({ data: ai }));
    cleanup(rendered);
  });

  it('adopts clean query refreshes, preserves dirty edits, and safely resets after save', async () => {
    const rendered = await renderForm();
    const refreshed: AiSettingsState = {
      ...ai,
      fields: { ...ai.fields, anthropic_model: { ...ai.fields.anthropic_model, value: 'claude-refreshed' } },
    };
    await act(async () => rendered.queryClient.setQueryData(['admin', 'settings', 'ai'], refreshed));
    await flush();
    expect(field(rendered.host, 'anthropic_model')).toHaveValue('claude-refreshed');
    expect(rendered.host.textContent).not.toContain('AI settings saved.');

    setValue(field(rendered.host, 'anthropic_model'), 'local-draft');
    await act(async () => rendered.queryClient.setQueryData(['admin', 'settings', 'ai'], ai));
    expect(field(rendered.host, 'anthropic_model')).toHaveValue('local-draft');

    const saved: AiSettingsState = {
      ...ai,
      fields: { ...ai.fields, anthropic_model: { ...ai.fields.anthropic_model, value: 'local-draft' } },
    };
    mocks.updateAiSettings.mockResolvedValueOnce({ data: saved });
    await click(button(rendered.host, 'Save'));
    await flush();
    expect(rendered.queryClient.getQueryData(['admin', 'settings', 'ai'])).toEqual(saved);
    expect(field(rendered.host, 'anthropic_model')).toHaveValue('local-draft');
    expect(field(rendered.host, 'openai_api_key')).toHaveValue('');
    expect(button(rendered.host, 'Save')).toBeDisabled();
    expect(rendered.host.textContent).toContain('AI settings saved.');
    cleanup(rendered);
  });
});
