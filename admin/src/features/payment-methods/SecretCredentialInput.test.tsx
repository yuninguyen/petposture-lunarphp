import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import en from '../../locales/en.json';
import viLocale from '../../locales/vi.json';

let language: 'en' | 'vi' = 'en';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => (
      (language === 'vi' ? viLocale : en)[key as keyof typeof en] ?? options?.defaultValue ?? key
    ),
  }),
}));

import { SecretCredentialInput } from './SecretCredentialInput';
import type { PaymentFieldState } from './api';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderInput(field: PaymentFieldState, overrides: Partial<Parameters<typeof SecretCredentialInput>[0]> = {}) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const props = {
    id: 'gateway-secret',
    label: 'Secret key',
    value: '',
    field,
    markedForClear: false,
    onChange: vi.fn(),
    onRequestClear: vi.fn(),
    onUndoClear: vi.fn(),
    ...overrides,
  };
  act(() => root.render(createElement(SecretCredentialInput, props)));
  return { host, root, props };
}

function cleanup(host: HTMLElement, root: ReturnType<typeof createRoot>) {
  act(() => root.unmount());
  host.remove();
}

describe('SecretCredentialInput', () => {
  it('renders translated actions, status, reveal label, and exact Vietnamese clear warning', () => {
    language = 'vi';
    const { host, root } = renderInput(
      { configured: true, source: 'database' },
      { markedForClear: true },
    );

    expect(host.textContent).toContain(viLocale['payment_methods.undo_remove_override']);
    expect(host.textContent).toContain(viLocale['payment_methods.hints.configured_database']);
    expect(host.querySelector('[data-action="toggle-secret"]')?.getAttribute('aria-label')).toBe(viLocale['payment_methods.show_candidate_credential']);
    expect(host.querySelector('[role="alert"]')?.textContent).toBe('Xóa giá trị ghi đè trong cơ sở dữ liệu — trường này sẽ quay về cấu hình môi trường nếu có. Thao tác này không xóa hoặc vô hiệu hóa giá trị môi trường.');

    cleanup(host, root);
    language = 'en';
  });

  it('starts blank and renders only safe configured status without fake masks', () => {
    const { host, root } = renderInput({ configured: true, source: 'database', hint: 'Configured in database.' });
    const input = host.querySelector<HTMLInputElement>('#gateway-secret')!;

    expect(input.value).toBe('');
    expect(input.type).toBe('password');
    expect(host.textContent).toContain('Configured in database.');
    expect(host.textContent).not.toMatch(/(?:[•●*?]|&#(?:8226|9679);){2,}/);
    expect(host.innerHTML).not.toContain('stored-secret');

    cleanup(host, root);
  });

  it.each([
    [{ configured: true, source: 'environment', hint: 'Configured by environment.' }, 'Configured by environment.'],
    [{ configured: false, source: 'none', hint: 'Not configured.' }, 'Not configured.'],
  ] as const)('shows safe metadata for %s', (field, text) => {
    const { host, root } = renderInput(field);
    expect(host.textContent).toContain(text);
    expect(host.querySelector<HTMLInputElement>('input')?.value).toBe('');
    cleanup(host, root);
  });

  it('reveals only the newly typed candidate and reports candidate changes', () => {
    const onChange = vi.fn();
    const { host, root } = renderInput(
      { configured: true, source: 'environment', hint: 'Configured by environment.' },
      { value: 'new-candidate-secret', onChange },
    );
    const input = host.querySelector<HTMLInputElement>('input')!;
    const reveal = host.querySelector<HTMLButtonElement>('[data-action="toggle-secret"]')!;

    expect(input.type).toBe('password');
    act(() => reveal.click());
    expect(input.type).toBe('text');
    expect(input.value).toBe('new-candidate-secret');

    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, 'next-candidate');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith('next-candidate');

    cleanup(host, root);
  });

  it('offers remove only for database source and invokes the clear callback', () => {
    const onRequestClear = vi.fn();
    const database = renderInput({ configured: true, source: 'database' }, { onRequestClear });
    const remove = database.host.querySelector<HTMLButtonElement>('[data-action="remove-override"]');
    expect(remove).not.toBeNull();
    expect(database.host.textContent).not.toContain('This does not remove or disable the environment value.');
    act(() => remove!.click());
    expect(onRequestClear).toHaveBeenCalledOnce();
    cleanup(database.host, database.root);

    for (const source of ['environment', 'none'] as const) {
      const rendered = renderInput({ configured: source === 'environment', source });
      expect(rendered.host.querySelector('[data-action="remove-override"]')).toBeNull();
      cleanup(rendered.host, rendered.root);
    }
  });

  it('shows the exact environment fallback warning only while marked for clear', () => {
    const warning = 'Remove database override — this field will fall back to environment configuration if available. This does not remove or disable the environment value.';
    const { host, root } = renderInput(
      { configured: true, source: 'database' },
      { markedForClear: true },
    );

    expect(host.textContent).toContain(warning);
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(warning);

    cleanup(host, root);
  });

  it('resets candidate and clear state when the parent rerenders controlled props', () => {
    const field = { configured: true, source: 'database' } as const;
    const { host, root, props } = renderInput(field, {
      value: 'replacement-candidate',
      markedForClear: true,
    });

    expect(host.querySelector<HTMLInputElement>('input')?.value).toBe('replacement-candidate');
    expect(host.textContent).toContain('This does not remove or disable the environment value.');

    act(() => root.render(createElement(SecretCredentialInput, {
      ...props,
      value: '',
      markedForClear: false,
    })));

    expect(host.querySelector<HTMLInputElement>('input')?.value).toBe('');
    expect(host.querySelector<HTMLInputElement>('input')?.disabled).toBe(false);
    expect(host.textContent).not.toContain('This does not remove or disable the environment value.');

    cleanup(host, root);
  });
});
