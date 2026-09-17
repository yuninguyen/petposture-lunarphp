import { act, createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../locales/en.json';
import viLocale from '../../locales/vi.json';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => en[key as keyof typeof en] ?? key }),
}));

vi.mock('./GeneralSettingsForm', async () => {
  const { createElement: h } = await import('react');
  return { GeneralSettingsForm: () => h('section', { 'data-form': 'General form' }, 'General form') };
});
vi.mock('./BrandingSettingsForm', async () => {
  const { createElement: h } = await import('react');
  return { BrandingSettingsForm: () => h('section', { 'data-form': 'Branding form' }, 'Branding form') };
});
vi.mock('./AnalyticsSettingsForm', async () => {
  const { createElement: h } = await import('react');
  return { AnalyticsSettingsForm: () => h('section', { 'data-form': 'Analytics form' }, 'Analytics form') };
});
vi.mock('./SmtpSettingsForm', async () => {
  const { createElement: h, useState: state } = await import('react');
  return { SmtpSettingsForm: () => {
    const [value, setValue] = state('');
    return h('section', { 'data-form': 'SMTP form' }, h('input', {
      'aria-label': 'SMTP form candidate',
      value,
      onChange: (event: { target: { value: string } }) => setValue(event.target.value),
    }));
  } };
});
vi.mock('./AiSettingsForm', async () => {
  const { createElement: h } = await import('react');
  return { AiSettingsForm: () => h('section', { 'data-form': 'AI form' }, 'AI form') };
});

import { SettingsPage } from './SettingsPage';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function click(element: Element) {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

function input(element: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

async function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(createElement(QueryClientProvider, { client: queryClient }, createElement(SettingsPage))));
  return { host, root, queryClient };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('SettingsPage', () => {
  it('renders five tabs in the fixed approved order and only mounts the active form', async () => {
    const { host, root } = await renderPage();
    const tabs = Array.from(host.querySelectorAll('[role="tab"]'));

    expect(tabs.map((tab) => tab.textContent)).toEqual(['General', 'Branding', 'Analytics', 'SMTP', 'AI Settings']);
    expect(host.querySelector('[data-form="General form"]')).not.toBeNull();
    expect(host.querySelectorAll('[data-form]').length).toBe(1);

    await act(async () => click(tabs[3]));
    expect(host.querySelector('[data-form="SMTP form"]')).not.toBeNull();
    expect(host.querySelectorAll('[data-form]').length).toBe(1);

    act(() => root.unmount());
    host.remove();
  });

  it('unmounts request-scoped secret candidates when switching tabs without placing them in QueryClient', async () => {
    const { host, root, queryClient } = await renderPage();
    const tabs = Array.from(host.querySelectorAll('[role="tab"]'));
    await act(async () => click(tabs[3]));

    const candidate = host.querySelector<HTMLInputElement>('input[aria-label="SMTP form candidate"]')!;
    await act(async () => input(candidate, 'smtp-candidate-sentinel'));
    expect(candidate.value).toBe('smtp-candidate-sentinel');

    await act(async () => click(tabs[4]));
    expect(host.textContent).not.toContain('smtp-candidate-sentinel');
    expect(host.querySelector('input[aria-label="SMTP form candidate"]')).toBeNull();
    expect(JSON.stringify(queryClient.getQueryCache().getAll().map((query) => query.state.data))).not.toContain('smtp-candidate-sentinel');

    act(() => root.unmount());
    host.remove();
  });

  it('provides complete non-empty English and Vietnamese settings copy', () => {
    const requiredKeys = [
      'nav.settings', 'settings.title', 'settings.subtitle',
      'settings.tabs.general', 'settings.tabs.branding', 'settings.tabs.analytics', 'settings.tabs.smtp', 'settings.tabs.ai',
      'settings.secrets.hints.database', 'settings.secrets.hints.environment', 'settings.secrets.hints.mixed', 'settings.secrets.hints.none',
      'settings.media_legacy_preview',
      'settings.secrets.remove_override', 'settings.secrets.undo_remove_override', 'settings.secrets.show_candidate',
      'settings.secrets.hide_candidate', 'settings.secrets.clear_confirmation',
      'settings_general.loading', 'settings_general.load_error', 'settings_general.shop_name',
      'settings_general.shop_name_required', 'settings_general.shop_description', 'settings_general.shop_logo',
      'settings_general.shop_favicon', 'settings_general.media_help', 'settings_general.save_error',
      'settings_general.save_success', 'settings_general.saving', 'settings_general.save',
      'settings_branding.loading', 'settings_branding.load_error', 'settings_branding.admin_logo',
      'settings_branding.admin_favicon', 'settings_branding.media_help', 'settings_branding.save_error',
      'settings_branding.save_success', 'settings_branding.saving', 'settings_branding.save',
      'settings_analytics.loading', 'settings_analytics.load_error', 'settings_analytics.google_analytics_id',
      'settings_analytics.save_error', 'settings_analytics.save_success', 'settings_analytics.saving', 'settings_analytics.save',
      'settings_smtp.loading', 'settings_smtp.load_error', 'settings_smtp.test_recipient',
      'settings_smtp.smtp_host', 'settings_smtp.smtp_port', 'settings_smtp.smtp_user', 'settings_smtp.smtp_pass',
      'settings_smtp.smtp_encryption', 'settings_smtp.mail_from_address', 'settings_smtp.encryption.none_selected',
      'settings_smtp.encryption.tls', 'settings_smtp.encryption.ssl', 'settings_smtp.encryption.none',
      'settings_smtp.test_success', 'settings_smtp.errors.rejected', 'settings_smtp.errors.unavailable',
      'settings_smtp.errors.save_failed', 'settings_smtp.save_success', 'settings_smtp.testing',
      'settings_smtp.test', 'settings_smtp.saving', 'settings_smtp.save',
      'settings_ai.loading', 'settings_ai.load_error', 'settings_ai.ai_seo_provider',
      'settings_ai.anthropic_api_key', 'settings_ai.anthropic_model', 'settings_ai.openai_api_key',
      'settings_ai.openai_model', 'settings_ai.openai_base_url', 'settings_ai.xai_api_key',
      'settings_ai.xai_model', 'settings_ai.gemini_api_key', 'settings_ai.gemini_model',
      'settings_ai.providers.auto', 'settings_ai.providers.anthropic', 'settings_ai.providers.openai',
      'settings_ai.providers.grok', 'settings_ai.providers.gemini', 'settings_ai.openai_model_empty',
      'settings_ai.errors.model_not_found', 'settings_ai.errors.rejected', 'settings_ai.errors.unavailable',
      'settings_ai.errors.save_failed', 'settings_ai.fetch_success', 'settings_ai.save_success',
      'settings_ai.fetching', 'settings_ai.fetch_models', 'settings_ai.saving', 'settings_ai.save',
    ];

    for (const locale of [en, viLocale]) {
      for (const key of requiredKeys) {
        expect(locale[key as keyof typeof locale], `${key} should be translated`).toBeTruthy();
      }
    }
  });
});
