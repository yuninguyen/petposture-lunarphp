import { act, createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../locales/en.json';

const mocks = vi.hoisted(() => ({
  fetchSmtpSettings: vi.fn(),
  updateSmtpSettings: vi.fn(),
  testSmtpSettings: vi.fn(),
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

import { SmtpSettingsForm } from './SmtpSettingsForm';
import type { SmtpSettingsState } from './api';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const smtp: SmtpSettingsState = {
  configured: true,
  source: 'database',
  fields: {
    smtp_host: { value: 'smtp.stored.test', configured: true, source: 'database', hint: 'Stored host' },
    smtp_port: { value: 587, configured: true, source: 'database', hint: 'Stored port' },
    smtp_user: { value: 'stored-user', configured: true, source: 'database', hint: 'Stored user' },
    smtp_pass: { configured: true, source: 'database', hint: 'Stored password' },
    smtp_encryption: { value: 'tls', configured: true, source: 'database', hint: 'Stored encryption' },
    mail_from_address: { value: 'mail@stored.test', configured: true, source: 'database', hint: 'Stored sender' },
  },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((next, fail) => { resolve = next; reject = fail; });
  return { promise, resolve, reject };
}

async function renderForm(queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
})) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(createElement(QueryClientProvider, { client: queryClient }, createElement(SmtpSettingsForm)));
  });
  await flush();
  return { host, root, queryClient };
}

async function flush() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
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

function button(host: HTMLElement, text: string) {
  return Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((candidate) => candidate.textContent === text)!;
}

function field(host: HTMLElement, key: string) {
  return host.querySelector<HTMLInputElement | HTMLSelectElement>(`#smtp-${key}`)!;
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
  mocks.fetchSmtpSettings.mockResolvedValue({ data: smtp });
  mocks.testSmtpSettings.mockResolvedValue({ data: { status: 'sent', message: 'server supplied safe message' } });
  mocks.updateSmtpSettings.mockResolvedValue({ data: smtp });
});

describe('SmtpSettingsForm', () => {
  it('hydrates all effective non-secret values, keeps the password blank, and has no recipient input', async () => {
    const rendered = await renderForm();

    expect(field(rendered.host, 'smtp_host')).toHaveValue('smtp.stored.test');
    expect(field(rendered.host, 'smtp_port')).toHaveValue(587);
    expect(field(rendered.host, 'smtp_user')).toHaveValue('stored-user');
    expect(field(rendered.host, 'smtp_pass')).toHaveValue('');
    expect(field(rendered.host, 'smtp_encryption')).toHaveValue('tls');
    expect(field(rendered.host, 'mail_from_address')).toHaveValue('mail@stored.test');
    expect(rendered.host.textContent).toContain('The test email is sent only to your signed-in administrator email address.');
    expect(rendered.host.textContent).toContain('Configured in database.');
    expect(rendered.host.textContent).not.toContain('Stored host');
    expect(rendered.host.textContent).not.toContain('Stored port');
    expect(rendered.host.textContent).not.toContain('Stored user');
    expect(rendered.host.textContent).not.toContain('Stored encryption');
    expect(rendered.host.textContent).not.toContain('Stored sender');
    expect(rendered.host.querySelector('input[name="recipient"]')).toBeNull();
    expect(button(rendered.host, 'Save')).toBeDisabled();

    cleanup(rendered);
  });

  it.each([
    ['smtp_host', 'smtp.changed.test'],
    ['smtp_port', '465'],
    ['smtp_user', 'changed-user'],
    ['smtp_pass', 'changed-password'],
    ['smtp_encryption', 'ssl'],
    ['mail_from_address', 'changed@example.test'],
  ])('requires a successful current test before saving a %s change', async (key, value) => {
    const rendered = await renderForm();
    setValue(field(rendered.host, key), value);

    expect(button(rendered.host, 'Save')).toBeDisabled();
    await click(button(rendered.host, 'Send test email'));
    expect(mocks.testSmtpSettings).toHaveBeenCalledTimes(1);
    expect(button(rendered.host, 'Save')).toBeEnabled();

    setValue(field(rendered.host, key), `${value}-again`);
    expect(button(rendered.host, 'Save')).toBeDisabled();
    cleanup(rendered);
  });

  it('builds minimal candidate payloads, omits an empty password, and saves only after testing', async () => {
    const saved: SmtpSettingsState = {
      ...smtp,
      fields: { ...smtp.fields, smtp_host: { ...smtp.fields.smtp_host, value: 'smtp.changed.test' } },
    };
    mocks.updateSmtpSettings.mockResolvedValueOnce({ data: saved });
    const rendered = await renderForm();

    setValue(field(rendered.host, 'smtp_host'), 'smtp.changed.test');
    setValue(field(rendered.host, 'smtp_pass'), '');
    await click(button(rendered.host, 'Send test email'));
    expect(mocks.testSmtpSettings).toHaveBeenCalledWith({ fields: { smtp_host: 'smtp.changed.test' } });

    await click(button(rendered.host, 'Save'));
    await flush();
    expect(mocks.updateSmtpSettings).toHaveBeenCalledWith({ fields: { smtp_host: 'smtp.changed.test' } });
    expect(rendered.queryClient.getQueryData(['admin', 'settings', 'smtp'])).toEqual(saved);
    expect(field(rendered.host, 'smtp_pass')).toHaveValue('');
    expect(button(rendered.host, 'Save')).toBeDisabled();
    expect(rendered.host.querySelector('[role="status"]')).toHaveTextContent('SMTP settings saved.');

    cleanup(rendered);
  });

  it.each(['smtp_host', 'smtp_port', 'smtp_user', 'smtp_encryption', 'mail_from_address'])('gates an explicit %s clear and sends only clear_fields', async (key) => {
    const rendered = await renderForm();
    const input = field(rendered.host, key);
    const group = input.closest('.space-y-2')!;

    await click(group.querySelector<HTMLElement>(`[data-action="remove-override"][data-field="${key}"]`)!);
    expect(input).toBeDisabled();
    expect(button(rendered.host, 'Save')).toBeDisabled();
    await click(button(rendered.host, 'Send test email'));
    expect(mocks.testSmtpSettings).toHaveBeenCalledWith({ clear_fields: [key] });
    expect(button(rendered.host, 'Save')).toBeEnabled();

    await click(group.querySelector<HTMLElement>(`[data-action="undo-remove-override"][data-field="${key}"]`)!);
    expect(input).toBeEnabled();
    expect(button(rendered.host, 'Save')).toBeDisabled();
    cleanup(rendered);
  });

  it('requires clear intent to be tested, keeps replacement and clear mutually exclusive, and undo restores baseline', async () => {
    const rendered = await renderForm();
    const password = field(rendered.host, 'smtp_pass');
    setValue(password, 'candidate-before-clear');

    await click(password.closest('.space-y-2')!.querySelector<HTMLElement>('[data-action="remove-override"]')!);
    expect(password).toHaveValue('');
    expect(password).toBeDisabled();
    expect(button(rendered.host, 'Save')).toBeDisabled();

    await click(button(rendered.host, 'Send test email'));
    expect(mocks.testSmtpSettings).toHaveBeenCalledWith({ clear_fields: ['smtp_pass'] });
    expect(button(rendered.host, 'Save')).toBeEnabled();

    await click(rendered.host.querySelector<HTMLElement>('[data-action="undo-remove-override"]')!);
    expect(password).toHaveValue('');
    expect(password).toBeEnabled();
    expect(button(rendered.host, 'Save')).toBeDisabled();
    expect(mocks.updateSmtpSettings).not.toHaveBeenCalled();
    cleanup(rendered);
  });

  it('removes the obsolete test requirement when a field is reverted to its baseline', async () => {
    const rendered = await renderForm();
    const host = field(rendered.host, 'smtp_host');
    setValue(host, 'smtp.changed.test');
    expect(button(rendered.host, 'Save')).toBeDisabled();

    setValue(host, 'smtp.stored.test');
    expect(button(rendered.host, 'Save')).toBeDisabled();
    await click(button(rendered.host, 'Send test email'));
    expect(mocks.testSmtpSettings).toHaveBeenCalledWith({});
    expect(button(rendered.host, 'Save')).toBeDisabled();
    cleanup(rendered);
  });

  it('does not authorize save after a failed test and maps 422 without rendering raw details', async () => {
    mocks.testSmtpSettings.mockRejectedValueOnce(Object.assign(new Error('SECRET provider rejection'), { status: 422 }));
    const rendered = await renderForm();
    setValue(field(rendered.host, 'smtp_host'), 'smtp.changed.test');

    await click(button(rendered.host, 'Send test email'));
    await flush();

    expect(button(rendered.host, 'Save')).toBeDisabled();
    expect(rendered.host.querySelector('[role="alert"]')).toHaveTextContent('The SMTP server rejected these settings.');
    expect(rendered.host.textContent).not.toContain('SECRET provider rejection');
    cleanup(rendered);
  });

  it('maps 502 and unexpected failures to controlled unavailable copy', async () => {
    for (const failure of [
      Object.assign(new Error('raw transport detail'), { status: 502 }),
      new Error('raw unexpected detail'),
    ]) {
      mocks.testSmtpSettings.mockRejectedValueOnce(failure);
      const rendered = await renderForm();
      setValue(field(rendered.host, 'smtp_host'), 'smtp.changed.test');
      await click(button(rendered.host, 'Send test email'));
      await flush();
      expect(rendered.host.querySelector('[role="alert"]')).toHaveTextContent('The SMTP server could not be reached. Try again.');
      expect(rendered.host.textContent).not.toContain('raw');
      cleanup(rendered);
    }
  });

  it('disables every control while testing and while saving', async () => {
    const testPending = deferred<{ data: { status: 'sent'; message: string } }>();
    mocks.testSmtpSettings.mockReturnValueOnce(testPending.promise);
    const rendered = await renderForm();
    setValue(field(rendered.host, 'smtp_host'), 'smtp.changed.test');
    await click(button(rendered.host, 'Send test email'));

    expect(field(rendered.host, 'smtp_host')).toBeDisabled();
    expect(button(rendered.host, 'Testing…')).toBeDisabled();
    expect(button(rendered.host, 'Save')).toBeDisabled();
    await act(async () => testPending.resolve({ data: { status: 'sent', message: 'safe' } }));
    await flush();
    expect(button(rendered.host, 'Save')).toBeEnabled();

    const savePending = deferred<{ data: SmtpSettingsState }>();
    mocks.updateSmtpSettings.mockReturnValueOnce(savePending.promise);
    await click(button(rendered.host, 'Save'));
    await flush();
    expect(field(rendered.host, 'smtp_host')).toBeDisabled();
    expect(button(rendered.host, 'Send test email')).toBeDisabled();
    expect(button(rendered.host, 'Saving…')).toBeDisabled();
    await act(async () => savePending.resolve({ data: smtp }));
    cleanup(rendered);
  });

  it('keeps password candidates out of both QueryCache and MutationCache during successful test and save', async () => {
    const sentinel = 'SMTP-SUPER-SECRET-SENTINEL';
    const saved: SmtpSettingsState = { ...smtp, source: 'environment' };
    mocks.updateSmtpSettings.mockResolvedValueOnce({ data: saved });
    const rendered = await renderForm();
    setValue(field(rendered.host, 'smtp_pass'), sentinel);

    await click(button(rendered.host, 'Send test email'));
    expect(mocks.testSmtpSettings).toHaveBeenCalledWith({ fields: { smtp_pass: sentinel } });
    expect(JSON.stringify(rendered.queryClient.getQueryCache().getAll().map((query) => query.state.data))).not.toContain(sentinel);
    expect(JSON.stringify(rendered.queryClient.getMutationCache().getAll().map((mutation) => mutation.state.variables))).not.toContain(sentinel);
    expect(JSON.stringify(localStorage)).not.toContain(sentinel);
    expect(JSON.stringify(sessionStorage)).not.toContain(sentinel);
    expect(window.location.href).not.toContain(sentinel);
    expect(rendered.host.querySelector('[role="status"]')?.textContent ?? '').not.toContain(sentinel);

    await click(button(rendered.host, 'Save'));
    await flush();
    expect(mocks.updateSmtpSettings).toHaveBeenCalledWith({ fields: { smtp_pass: sentinel } });
    expect(field(rendered.host, 'smtp_pass')).toHaveValue('');
    expect(JSON.stringify(rendered.queryClient.getQueryCache().getAll().map((query) => query.state.data))).not.toContain(sentinel);
    expect(JSON.stringify(rendered.queryClient.getMutationCache().getAll().map((mutation) => mutation.state.variables))).not.toContain(sentinel);
    expect(rendered.host.textContent).not.toContain(sentinel);
    cleanup(rendered);
  });

  it('keeps password candidates out of MutationCache when test and save fail', async () => {
    const sentinel = 'SMTP-FAILED-SECRET-SENTINEL';
    mocks.testSmtpSettings.mockRejectedValueOnce(Object.assign(new Error(sentinel), { status: 422 }));
    mocks.updateSmtpSettings.mockRejectedValueOnce(new Error(sentinel));
    const rendered = await renderForm();
    setValue(field(rendered.host, 'smtp_pass'), sentinel);

    await click(button(rendered.host, 'Send test email'));
    await flush();
    expect(JSON.stringify(rendered.queryClient.getMutationCache().getAll().map((mutation) => mutation.state.variables))).not.toContain(sentinel);

    mocks.testSmtpSettings.mockResolvedValueOnce({ data: { status: 'sent', message: 'safe' } });
    await click(button(rendered.host, 'Send test email'));
    await click(button(rendered.host, 'Save'));
    await flush();
    expect(JSON.stringify(rendered.queryClient.getMutationCache().getAll().map((mutation) => mutation.state.variables))).not.toContain(sentinel);
    expect(rendered.host.textContent).not.toContain(sentinel);
    cleanup(rendered);
  });

  it('uses the latest test response and ignores an older success that resolves last', async () => {
    const first = deferred<{ data: { status: 'sent'; message: string } }>();
    const second = deferred<{ data: { status: 'sent'; message: string } }>();
    mocks.testSmtpSettings.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const rendered = await renderForm();
    setValue(field(rendered.host, 'smtp_host'), 'first.test');

    await click(button(rendered.host, 'Send test email'));
    setValue(field(rendered.host, 'smtp_host'), 'second.test');
    await click(button(rendered.host, 'Send test email'));
    expect(mocks.testSmtpSettings).toHaveBeenCalledTimes(2);

    await act(async () => second.resolve({ data: { status: 'sent', message: 'second' } }));
    await flush();
    expect(button(rendered.host, 'Save')).toBeEnabled();
    await act(async () => first.resolve({ data: { status: 'sent', message: 'first' } }));
    await flush();
    expect(button(rendered.host, 'Save')).toBeEnabled();
    cleanup(rendered);
  });

  it('locks duplicate synchronous save submissions and adopts only the latest accepted save', async () => {
    const pendingSave = deferred<{ data: SmtpSettingsState }>();
    mocks.updateSmtpSettings.mockReturnValueOnce(pendingSave.promise);
    const rendered = await renderForm();
    setValue(field(rendered.host, 'smtp_host'), 'smtp.changed.test');
    await click(button(rendered.host, 'Send test email'));

    const save = button(rendered.host, 'Save');
    await act(async () => {
      save.click();
      save.click();
    });
    expect(mocks.updateSmtpSettings).toHaveBeenCalledTimes(1);

    const saved: SmtpSettingsState = {
      ...smtp,
      fields: { ...smtp.fields, smtp_host: { ...smtp.fields.smtp_host, value: 'smtp.changed.test' } },
    };
    await act(async () => pendingSave.resolve({ data: saved }));
    await flush();
    expect(field(rendered.host, 'smtp_host')).toHaveValue('smtp.changed.test');
    cleanup(rendered);
  });

  it('adopts a clean cached refresh but preserves dirty local edits and ignores refresh while pending', async () => {
    const rendered = await renderForm();
    const cleanRefresh: SmtpSettingsState = {
      ...smtp,
      fields: { ...smtp.fields, smtp_host: { ...smtp.fields.smtp_host, value: 'clean-refresh.test' } },
    };
    await act(async () => rendered.queryClient.setQueryData(['admin', 'settings', 'smtp'], cleanRefresh));
    await flush();
    expect(field(rendered.host, 'smtp_host')).toHaveValue('clean-refresh.test');
    expect(rendered.host.textContent).not.toContain('SMTP settings saved.');

    setValue(field(rendered.host, 'smtp_host'), 'local-draft.test');
    await act(async () => rendered.queryClient.setQueryData(['admin', 'settings', 'smtp'], {
      ...smtp,
      fields: { ...smtp.fields, smtp_host: { ...smtp.fields.smtp_host, value: 'dirty-refresh.test' } },
    }));
    expect(field(rendered.host, 'smtp_host')).toHaveValue('local-draft.test');

    const pendingTest = deferred<{ data: { status: 'sent'; message: string } }>();
    mocks.testSmtpSettings.mockReturnValueOnce(pendingTest.promise);
    await click(button(rendered.host, 'Send test email'));
    await act(async () => rendered.queryClient.setQueryData(['admin', 'settings', 'smtp'], cleanRefresh));
    expect(field(rendered.host, 'smtp_host')).toHaveValue('local-draft.test');
    await act(async () => pendingTest.resolve({ data: { status: 'sent', message: 'safe' } }));
    cleanup(rendered);
  });
});
