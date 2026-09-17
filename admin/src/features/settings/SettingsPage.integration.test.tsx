import { act, createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../locales/en.json';

const mocks = vi.hoisted(() => ({
  fetchGeneralSettings: vi.fn(),
  fetchBrandingSettings: vi.fn(),
  fetchAnalyticsSettings: vi.fn(),
  fetchSmtpSettings: vi.fn(),
  testSmtpSettings: vi.fn(),
  updateSmtpSettings: vi.fn(),
  fetchAiSettings: vi.fn(),
  fetchAiModels: vi.fn(),
  updateAiSettings: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => en[key as keyof typeof en] ?? key }),
}));

vi.mock('./api', async (importOriginal) => ({
  ...await importOriginal<typeof import('./api')>(),
  ...mocks,
}));

import { SettingsPage } from './SettingsPage';
import type { AiSettingsState, SmtpSettingsState } from './api';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const smtp: SmtpSettingsState = {
  configured: true,
  source: 'database',
  fields: {
    smtp_host: { value: 'smtp.initial.test', configured: true, source: 'database', hint: '' },
    smtp_port: { value: 587, configured: true, source: 'database', hint: '' },
    smtp_user: { value: 'user', configured: true, source: 'database', hint: '' },
    smtp_pass: { configured: true, source: 'database', hint: '' },
    smtp_encryption: { value: 'tls', configured: true, source: 'database', hint: '' },
    mail_from_address: { value: 'mail@example.test', configured: true, source: 'database', hint: '' },
  },
};

const ai: AiSettingsState = {
  configured: true,
  source: 'database',
  fields: {
    ai_seo_provider: { value: 'auto', configured: true, source: 'database', hint: '' },
    anthropic_api_key: { configured: true, source: 'database', hint: '' },
    anthropic_model: { value: 'claude-initial', configured: true, source: 'database', hint: '' },
    openai_api_key: { configured: true, source: 'database', hint: '' },
    openai_model: { value: 'gpt-initial', configured: true, source: 'database', hint: '' },
    openai_base_url: { value: 'https://api.openai.com/v1', configured: true, source: 'database', hint: '' },
    xai_api_key: { configured: true, source: 'database', hint: '' },
    xai_model: { value: 'grok-initial', configured: true, source: 'database', hint: '' },
    gemini_api_key: { configured: true, source: 'database', hint: '' },
    gemini_model: { value: 'gemini-initial', configured: true, source: 'database', hint: '' },
  },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

async function flush() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}

function click(element: HTMLElement) {
  return act(async () => element.click());
}

function setValue(element: HTMLInputElement | HTMLSelectElement, value: string) {
  act(() => {
    const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value);
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function tab(host: HTMLElement, label: string) {
  return Array.from(host.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find((item) => item.textContent === label)!;
}

function button(host: HTMLElement, label: string) {
  return Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((item) => item.textContent === label)!;
}

async function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(createElement(QueryClientProvider, { client: queryClient }, createElement(SettingsPage))));
  await flush();
  return { host, root, queryClient };
}

beforeEach(() => {
  vi.resetAllMocks();
  document.body.innerHTML = '';
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  mocks.fetchGeneralSettings.mockResolvedValue({ data: { shop_name: 'PetPosture', shop_logo: null, shop_favicon: null, shop_description: null } });
  mocks.fetchBrandingSettings.mockResolvedValue({ data: { admin_logo: null, admin_favicon: null } });
  mocks.fetchAnalyticsSettings.mockResolvedValue({ data: { google_analytics_id: null } });
  mocks.fetchSmtpSettings.mockResolvedValue({ data: smtp });
  mocks.testSmtpSettings.mockResolvedValue({ data: { status: 'sent', message: 'safe' } });
  mocks.fetchAiSettings.mockResolvedValue({ data: ai });
  mocks.fetchAiModels.mockResolvedValue({ data: { status: 'loaded', models: ['gpt-initial'] } });
});

describe('SettingsPage save ordering across tab remounts', () => {
  it('does not let an older SMTP save overwrite a newer remounted save', async () => {
    const saveA = deferred<{ data: SmtpSettingsState }>();
    const saveB = deferred<{ data: SmtpSettingsState }>();
    mocks.updateSmtpSettings.mockReturnValueOnce(saveA.promise).mockReturnValueOnce(saveB.promise);
    const rendered = await renderPage();

    await click(tab(rendered.host, 'SMTP'));
    await flush();
    setValue(rendered.host.querySelector<HTMLInputElement>('#smtp-smtp_host')!, 'smtp-a.test');
    await click(button(rendered.host, 'Send test email'));
    await click(button(rendered.host, 'Save'));

    await click(tab(rendered.host, 'General'));
    await click(tab(rendered.host, 'SMTP'));
    await flush();
    setValue(rendered.host.querySelector<HTMLInputElement>('#smtp-smtp_host')!, 'smtp-b.test');
    await click(button(rendered.host, 'Send test email'));
    await click(button(rendered.host, 'Save'));

    const stateB: SmtpSettingsState = { ...smtp, fields: { ...smtp.fields, smtp_host: { ...smtp.fields.smtp_host, value: 'smtp-b.test' } } };
    const stateA: SmtpSettingsState = { ...smtp, fields: { ...smtp.fields, smtp_host: { ...smtp.fields.smtp_host, value: 'smtp-a.test' } } };
    await act(async () => saveB.resolve({ data: stateB }));
    await flush();
    await act(async () => saveA.resolve({ data: stateA }));
    await flush();

    expect(rendered.queryClient.getQueryData(['admin', 'settings', 'smtp'])).toEqual(stateB);
    expect(rendered.host.querySelector<HTMLInputElement>('#smtp-smtp_host')).toHaveValue('smtp-b.test');
    act(() => rendered.root.unmount());
  });

  it('does not let an older AI save overwrite a newer remounted save', async () => {
    const saveA = deferred<{ data: AiSettingsState }>();
    const saveB = deferred<{ data: AiSettingsState }>();
    mocks.updateAiSettings.mockReturnValueOnce(saveA.promise).mockReturnValueOnce(saveB.promise);
    const rendered = await renderPage();

    await click(tab(rendered.host, 'AI Settings'));
    await flush();
    setValue(rendered.host.querySelector<HTMLInputElement>('#ai-anthropic_model')!, 'claude-a');
    await click(button(rendered.host, 'Save'));

    await click(tab(rendered.host, 'General'));
    await click(tab(rendered.host, 'AI Settings'));
    await flush();
    setValue(rendered.host.querySelector<HTMLInputElement>('#ai-anthropic_model')!, 'claude-b');
    await click(button(rendered.host, 'Save'));

    const stateB: AiSettingsState = { ...ai, fields: { ...ai.fields, anthropic_model: { ...ai.fields.anthropic_model, value: 'claude-b' } } };
    const stateA: AiSettingsState = { ...ai, fields: { ...ai.fields, anthropic_model: { ...ai.fields.anthropic_model, value: 'claude-a' } } };
    await act(async () => saveB.resolve({ data: stateB }));
    await flush();
    await act(async () => saveA.resolve({ data: stateA }));
    await flush();

    expect(rendered.queryClient.getQueryData(['admin', 'settings', 'ai'])).toEqual(stateB);
    expect(rendered.host.querySelector<HTMLInputElement>('#ai-anthropic_model')).toHaveValue('claude-b');
    act(() => rendered.root.unmount());
  });
});
