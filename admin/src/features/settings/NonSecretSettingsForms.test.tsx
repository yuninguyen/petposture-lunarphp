import { act, createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../locales/en.json';

const mocks = vi.hoisted(() => ({
  fetchGeneralSettings: vi.fn(),
  updateGeneralSettings: vi.fn(),
  fetchBrandingSettings: vi.fn(),
  updateBrandingSettings: vi.fn(),
  fetchAnalyticsSettings: vi.fn(),
  updateAnalyticsSettings: vi.fn(),
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

vi.mock('@/features/media/MediaPicker', () => ({
  MediaPicker: ({ value, onChange, context, disabled, preview }: {
    value: { id: string | null; url: string } | null;
    onChange(value: { id: string | null; url: string } | null): void;
    context: string;
    disabled?: boolean;
    preview?: string;
  }) => (
    <div data-testid="media-picker" data-context={context} data-id={value?.id ?? 'null'} data-url={value?.url ?? ''} data-preview={preview ?? 'default'} data-disabled={String(Boolean(disabled))}>
      <button type="button" disabled={disabled} data-action="select-media" onClick={() => onChange({ id: '123', url: 'https://cdn.example/new.png' })}>Select media</button>
      <button type="button" disabled={disabled} data-action="remove-media" onClick={() => onChange(null)}>Remove media</button>
    </div>
  ),
}));

import { AnalyticsSettingsForm } from './AnalyticsSettingsForm';
import { BrandingSettingsForm } from './BrandingSettingsForm';
import { GeneralSettingsForm } from './GeneralSettingsForm';
import type { AnalyticsSettingsState, BrandingSettingsState, GeneralSettingsState } from './api';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const general: GeneralSettingsState = {
  shop_name: 'PetPosture',
  shop_description: 'Stored description',
  shop_logo: { id: null, url: 'https://cdn.example/legacy-logo.png' },
  shop_favicon: { id: '22', url: 'https://cdn.example/favicon.png' },
};
const branding: BrandingSettingsState = {
  admin_logo: { id: null, url: 'https://cdn.example/legacy-admin.png' },
  admin_favicon: { id: '44', url: 'https://cdn.example/admin-favicon.png' },
};
const analytics: AnalyticsSettingsState = { google_analytics_id: 'G-STORED' };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

async function renderForm(element: React.ReactElement, queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
})) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(createElement(QueryClientProvider, { client: queryClient }, element));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return { host, root, queryClient };
}

function setValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  act(() => {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function click(element: HTMLElement) {
  await act(async () => element.click());
}

function button(host: HTMLElement, text = 'Save') {
  return Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((candidate) => candidate.textContent === text)!;
}

function cleanup(rendered: Awaited<ReturnType<typeof renderForm>>) {
  act(() => rendered.root.unmount());
  rendered.host.remove();
  rendered.queryClient.clear();
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.fetchGeneralSettings.mockResolvedValue({ data: general });
  mocks.fetchBrandingSettings.mockResolvedValue({ data: branding });
  mocks.fetchAnalyticsSettings.mockResolvedValue({ data: analytics });
});

describe('non-secret settings forms', () => {
  it('renders General fields, previews legacy media, and uses the general media context', async () => {
    const rendered = await renderForm(<GeneralSettingsForm />);

    expect(rendered.host.querySelector<HTMLInputElement>('#shop_name')).toHaveValue('PetPosture');
    expect(rendered.host.querySelector<HTMLTextAreaElement>('#shop_description')).toHaveValue('Stored description');
    expect(rendered.host.querySelectorAll('[data-testid="media-picker"]')).toHaveLength(2);
    expect(Array.from(rendered.host.querySelectorAll('[data-testid="media-picker"]')).every((picker) => picker.getAttribute('data-context') === 'general')).toBe(true);
    expect(rendered.host.querySelectorAll('[data-testid="media-picker"]')[0]).toHaveAttribute('data-preview', 'logo');
    expect(rendered.host.querySelector('[data-url="https://cdn.example/legacy-logo.png"]')).toHaveAttribute('data-id', 'null');
    expect(rendered.host.querySelectorAll('[data-testid="media-picker"]')[1]).toHaveAttribute('data-preview', 'favicon');
    expect(rendered.host.textContent).toContain('Select an image from the general media library.');
    expect(rendered.host.textContent).toContain('Use a square PNG favicon — recommended 512 × 512 px (minimum 48 × 48 px).');
    expect(rendered.host.querySelector('[role="note"]')).toHaveTextContent('This legacy image has no media library ID. Select a new image to replace it.');
    expect(button(rendered.host)).toBeDisabled();

    cleanup(rendered);
  });

  it('sends only changed General media, replaces query data with the server response, and resets local state', async () => {
    const saved: GeneralSettingsState = {
      ...general,
      shop_logo: { id: '123', url: 'https://cdn.example/new.png' },
    };
    const pending = deferred<{ data: GeneralSettingsState }>();
    mocks.updateGeneralSettings.mockReturnValueOnce(pending.promise);
    const rendered = await renderForm(<GeneralSettingsForm />);

    await click(rendered.host.querySelector<HTMLElement>('[data-testid="media-picker"] [data-action="select-media"]')!);
    const save = button(rendered.host);
    await act(async () => save.click());

    expect(mocks.updateGeneralSettings).toHaveBeenCalledWith({ shop_logo: { media_id: '123' } });
    expect(rendered.queryClient.getQueryData(['admin', 'settings', 'general'])).toEqual(general);

    await act(async () => pending.resolve({ data: saved }));
    expect(rendered.queryClient.getQueryData(['admin', 'settings', 'general'])).toEqual(saved);
    expect(rendered.host.querySelector('[data-url="https://cdn.example/new.png"]')).toHaveAttribute('data-id', '123');
    expect(rendered.host.querySelector<HTMLButtonElement>('button[type="submit"]')).toBeDisabled();

    cleanup(rendered);
  });

  it('sends explicit null when General media is removed and omits unchanged text fields', async () => {
    mocks.updateGeneralSettings.mockResolvedValueOnce({ data: { ...general, shop_logo: null } });
    const rendered = await renderForm(<GeneralSettingsForm />);

    await click(rendered.host.querySelector<HTMLElement>('[data-testid="media-picker"] [data-action="remove-media"]')!);
    await click(button(rendered.host));

    expect(mocks.updateGeneralSettings).toHaveBeenCalledWith({ shop_logo: null });
    cleanup(rendered);
  });

  it('renders Branding media with general context and submits new and removed media minimally', async () => {
    const saved: BrandingSettingsState = {
      admin_logo: { id: '123', url: 'https://cdn.example/new.png' },
      admin_favicon: null,
    };
    mocks.updateBrandingSettings.mockResolvedValueOnce({ data: saved });
    const rendered = await renderForm(<BrandingSettingsForm />);
    const pickers = rendered.host.querySelectorAll<HTMLElement>('[data-testid="media-picker"]');

    expect(pickers).toHaveLength(2);
    expect(Array.from(pickers).every((picker) => picker.dataset.context === 'general')).toBe(true);
    expect(pickers[0]).toHaveAttribute('data-id', 'null');
    expect(pickers[0]).toHaveAttribute('data-preview', 'logo');
    expect(pickers[1]).toHaveAttribute('data-preview', 'favicon');
    expect(rendered.host.textContent).toContain('Select an image from the general media library.');
    expect(rendered.host.textContent).toContain('Use a square PNG favicon — recommended 512 × 512 px (minimum 48 × 48 px).');
    expect(rendered.host.querySelector('[role="note"]')).toHaveTextContent('This legacy image has no media library ID. Select a new image to replace it.');
    await click(pickers[0].querySelector<HTMLElement>('[data-action="select-media"]')!);
    await click(pickers[1].querySelector<HTMLElement>('[data-action="remove-media"]')!);
    await click(button(rendered.host));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

    expect(mocks.updateBrandingSettings).toHaveBeenCalledWith({
      admin_logo: { media_id: '123' },
      admin_favicon: null,
    });
    expect(rendered.queryClient.getQueryData(['admin', 'settings', 'branding'])).toEqual(saved);
    expect(button(rendered.host)).toBeDisabled();
    cleanup(rendered);
  });

  it('renders Analytics, submits only a changed GA ID, and replaces query data', async () => {
    const saved = { google_analytics_id: 'G-NEW' };
    mocks.updateAnalyticsSettings.mockResolvedValueOnce({ data: saved });
    const rendered = await renderForm(<AnalyticsSettingsForm />);
    const input = rendered.host.querySelector<HTMLInputElement>('#google_analytics_id')!;

    expect(input).toHaveValue('G-STORED');
    expect(button(rendered.host)).toBeDisabled();
    setValue(input, 'G-NEW');
    await click(button(rendered.host));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

    expect(mocks.updateAnalyticsSettings).toHaveBeenCalledWith({ google_analytics_id: 'G-NEW' });
    expect(rendered.queryClient.getQueryData(['admin', 'settings', 'analytics'])).toEqual(saved);
    expect(button(rendered.host)).toBeDisabled();
    cleanup(rendered);
  });

  it('trims the shop name, rejects a blank value accessibly, and submits only the normalized change', async () => {
    mocks.updateGeneralSettings.mockResolvedValueOnce({ data: { ...general, shop_name: 'New Shop' } });
    const rendered = await renderForm(<GeneralSettingsForm />);
    const input = rendered.host.querySelector<HTMLInputElement>('#shop_name')!;

    setValue(input, '   ');
    await click(button(rendered.host));
    expect(mocks.updateGeneralSettings).not.toHaveBeenCalled();
    expect(rendered.host.querySelector('[role="alert"]')).toHaveTextContent('Shop name is required.');
    expect(input).toHaveAttribute('aria-invalid', 'true');

    setValue(input, '  New Shop  ');
    expect(rendered.host.querySelector('[role="alert"]')).toBeNull();
    await click(button(rendered.host));

    expect(mocks.updateGeneralSettings).toHaveBeenCalledWith({ shop_name: 'New Shop' });
    cleanup(rendered);
  });

  it('disables General media controls while saving and shows an accessible success status after save', async () => {
    const saved = { ...general, shop_logo: { id: '123', url: 'https://cdn.example/new.png' } };
    const pending = deferred<{ data: GeneralSettingsState }>();
    mocks.updateGeneralSettings.mockReturnValueOnce(pending.promise);
    const rendered = await renderForm(<GeneralSettingsForm />);

    await click(rendered.host.querySelector<HTMLElement>('[data-action="select-media"]')!);
    await click(button(rendered.host));
    expect(Array.from(rendered.host.querySelectorAll('[data-testid="media-picker"]')).every((picker) => picker.getAttribute('data-disabled') === 'true')).toBe(true);

    await act(async () => pending.resolve({ data: saved }));
    expect(rendered.host.querySelector('[role="status"]')).toHaveTextContent('General settings saved.');
    setValue(rendered.host.querySelector<HTMLInputElement>('#shop_name')!, 'Edited again');
    expect(rendered.host.querySelector('[role="status"]')).toBeNull();
    cleanup(rendered);
  });

  it('preserves dirty General edits when cached query data refreshes', async () => {
    const rendered = await renderForm(<GeneralSettingsForm />);
    const input = rendered.host.querySelector<HTMLInputElement>('#shop_name')!;
    setValue(input, 'Local draft');

    await act(async () => {
      rendered.queryClient.setQueryData(['admin', 'settings', 'general'], { ...general, shop_name: 'Server refresh' });
    });

    expect(input).toHaveValue('Local draft');
    cleanup(rendered);
  });

  it('labels every media group accessibly', async () => {
    const generalRendered = await renderForm(<GeneralSettingsForm />);
    expect(generalRendered.host.querySelector('fieldset[aria-labelledby="shop-logo-label"]')).not.toBeNull();
    expect(generalRendered.host.querySelector('fieldset[aria-labelledby="shop-favicon-label"]')).not.toBeNull();
    cleanup(generalRendered);

    const brandingRendered = await renderForm(<BrandingSettingsForm />);
    expect(brandingRendered.host.querySelector('fieldset[aria-labelledby="admin-logo-label"]')).not.toBeNull();
    expect(brandingRendered.host.querySelector('fieldset[aria-labelledby="admin-favicon-label"]')).not.toBeNull();
    cleanup(brandingRendered);
  });

  it('sends explicit null when Analytics is cleared and reports controlled failure', async () => {
    mocks.updateAnalyticsSettings.mockRejectedValueOnce(new Error('raw provider detail'));
    const rendered = await renderForm(<AnalyticsSettingsForm />);
    const input = rendered.host.querySelector<HTMLInputElement>('#google_analytics_id')!;

    setValue(input, '');
    await click(button(rendered.host));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

    expect(mocks.updateAnalyticsSettings).toHaveBeenCalledWith({ google_analytics_id: null });
    expect(rendered.host.querySelector('[role="alert"]')).toHaveTextContent('Analytics settings could not be saved.');
    expect(rendered.host.textContent).not.toContain('raw provider detail');
    cleanup(rendered);
  });

  it('does not let refreshed Branding query data overwrite a dirty media selection', async () => {
    const rendered = await renderForm(<BrandingSettingsForm />);
    await click(rendered.host.querySelector<HTMLElement>('[data-action="select-media"]')!);

    await act(async () => {
      rendered.queryClient.setQueryData(['admin', 'settings', 'branding'], {
        ...branding,
        admin_logo: { id: '99', url: 'https://cdn.example/refreshed.png' },
      });
    });

    expect(rendered.host.querySelector('[data-testid="media-picker"]')).toHaveAttribute('data-id', '123');
    cleanup(rendered);
  });
});
