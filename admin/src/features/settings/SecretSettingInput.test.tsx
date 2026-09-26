import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

const translations: Record<string, string> = {
  'settings.secrets.hints.database': 'Configured in database.',
  'settings.secrets.hints.environment': 'Configured by environment.',
  'settings.secrets.hints.none': 'Not configured.',
  'settings.secrets.remove_override': 'Remove database override',
  'settings.secrets.undo_remove_override': 'Undo removal',
  'settings.secrets.show_candidate': 'Show candidate credential',
  'settings.secrets.hide_candidate': 'Hide candidate credential',
  'settings.secrets.clear_confirmation': 'Remove database override — this field will fall back to environment configuration if available. This does not remove or disable the environment value.',
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => translations[key] ?? options?.defaultValue ?? key,
  }),
}));

import { SecretSettingInput } from './SecretSettingInput';
import type { SafeSecretField } from './api';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderInput(field: SafeSecretField, overrides: Partial<Parameters<typeof SecretSettingInput>[0]> = {}) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const props = {
    id: 'smtp-pass',
    label: 'SMTP password',
    value: '',
    field,
    markedForClear: false,
    onChange: vi.fn(),
    onRequestClear: vi.fn(),
    onUndoClear: vi.fn(),
    ...overrides,
  };
  act(() => root.render(createElement(SecretSettingInput, props)));
  return { host, root, props };
}

function cleanup(host: HTMLElement, root: ReturnType<typeof createRoot>) {
  act(() => root.unmount());
  host.remove();
}

describe('SecretSettingInput', () => {
  it('starts blank and renders only safe metadata without masks', () => {
    const { host, root } = renderInput({ configured: true, source: 'database', hint: 'Configured in database' });
    const input = host.querySelector<HTMLInputElement>('input')!;

    expect(input.value).toBe('');
    expect(input.type).toBe('password');
    expect(host.textContent).toContain('Configured in database.');
    expect(host.textContent).not.toMatch(/(?:[•●*?]|&#(?:8226|9679);){2,}/);
    expect(host.innerHTML).not.toContain('stored-secret');

    cleanup(host, root);
  });

  it.each([
    [{ configured: true, source: 'environment', hint: 'Using environment configuration' }, 'Configured by environment.'],
    [{ configured: false, source: 'none', hint: 'Not configured' }, 'Not configured.'],
  ] as const)('renders localized safe status for %s', (field, expected) => {
    const { host, root } = renderInput(field);
    expect(host.textContent).toContain(expected);
    cleanup(host, root);
  });

  it('reveals only the controlled candidate and reports candidate edits', () => {
    const onChange = vi.fn();
    const { host, root } = renderInput(
      { configured: true, source: 'environment', hint: 'Using environment configuration' },
      { value: 'new-candidate-secret', onChange },
    );
    const input = host.querySelector<HTMLInputElement>('input')!;
    const reveal = host.querySelector<HTMLButtonElement>('[data-action="toggle-secret"]')!;

    expect(reveal.getAttribute('aria-label')).toBe('Show candidate credential');
    act(() => reveal.click());
    expect(input.type).toBe('text');
    expect(input.value).toBe('new-candidate-secret');
    expect(reveal.getAttribute('aria-label')).toBe('Hide candidate credential');

    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, 'next-candidate');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith('next-candidate');

    cleanup(host, root);
  });

  it('loads and shows the stored database key read-only on demand, and forgets it when hidden', async () => {
    const onReveal = vi.fn().mockResolvedValue('stored-key-123');
    const { host, root } = renderInput(
      { configured: true, source: 'database', hint: 'Configured in database' },
      { onReveal },
    );
    const input = host.querySelector<HTMLInputElement>('input')!;
    const toggle = host.querySelector<HTMLButtonElement>('[data-action="toggle-secret"]')!;

    expect(onReveal).not.toHaveBeenCalled();
    await act(async () => { toggle.click(); });
    expect(onReveal).toHaveBeenCalledOnce();
    expect(input.type).toBe('text');
    expect(input.value).toBe('stored-key-123');
    expect(input.readOnly).toBe(true);

    await act(async () => { toggle.click(); });
    expect(input.type).toBe('password');
    expect(input.value).toBe('');
    expect(host.innerHTML).not.toContain('stored-key-123');

    await act(async () => { toggle.click(); });
    expect(onReveal).toHaveBeenCalledTimes(2);

    cleanup(host, root);
  });

  it('does not request the stored key for environment source or when a new candidate was typed', async () => {
    const onReveal = vi.fn().mockResolvedValue('should-not-load');
    const environment = renderInput(
      { configured: true, source: 'environment', hint: 'Using environment configuration' },
      { onReveal },
    );
    await act(async () => { environment.host.querySelector<HTMLButtonElement>('[data-action="toggle-secret"]')!.click(); });
    expect(onReveal).not.toHaveBeenCalled();
    cleanup(environment.host, environment.root);

    const typed = renderInput(
      { configured: true, source: 'database', hint: 'Configured in database' },
      { onReveal, value: 'typed-candidate' },
    );
    await act(async () => { typed.host.querySelector<HTMLButtonElement>('[data-action="toggle-secret"]')!.click(); });
    expect(onReveal).not.toHaveBeenCalled();
    expect(typed.host.querySelector<HTMLInputElement>('input')!.value).toBe('typed-candidate');
    cleanup(typed.host, typed.root);
  });

  it('shows an error and keeps the field blank when the stored key cannot be loaded', async () => {
    const onReveal = vi.fn().mockRejectedValue(new Error('forbidden'));
    const { host, root } = renderInput(
      { configured: true, source: 'database', hint: 'Configured in database' },
      { onReveal },
    );

    await act(async () => { host.querySelector<HTMLButtonElement>('[data-action="toggle-secret"]')!.click(); });

    expect(host.querySelector<HTMLInputElement>('input')!.value).toBe('');
    expect(host.querySelector('[role="alert"]')).not.toBeNull();

    cleanup(host, root);
  });

  it('offers clear only for database source and invokes clear', () => {
    const onRequestClear = vi.fn();
    const database = renderInput(
      { configured: true, source: 'database', hint: 'Configured in database' },
      { onRequestClear },
    );
    const remove = database.host.querySelector<HTMLButtonElement>('[data-action="remove-override"]')!;
    expect(remove.textContent).toBe('Remove database override');
    act(() => remove.click());
    expect(onRequestClear).toHaveBeenCalledOnce();
    cleanup(database.host, database.root);

    for (const field of [
      { configured: true, source: 'environment', hint: 'Using environment configuration' },
      { configured: false, source: 'none', hint: 'Not configured' },
    ] as const) {
      const rendered = renderInput(field);
      expect(rendered.host.querySelector('[data-action="remove-override"]')).toBeNull();
      cleanup(rendered.host, rendered.root);
    }
  });

  it('shows localized clear warning and invokes undo while marked for clear', () => {
    const onUndoClear = vi.fn();
    const { host, root } = renderInput(
      { configured: true, source: 'database', hint: 'Configured in database' },
      { value: 'candidate-must-not-show', markedForClear: true, onUndoClear },
    );
    const undo = host.querySelector<HTMLButtonElement>('[data-action="undo-remove-override"]')!;

    expect(undo.textContent).toBe('Undo removal');
    expect(host.querySelector<HTMLInputElement>('input')?.disabled).toBe(true);
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(translations['settings.secrets.clear_confirmation']);
    expect(host.textContent).not.toContain('candidate-must-not-show');
    act(() => undo.click());
    expect(onUndoClear).toHaveBeenCalledOnce();

    cleanup(host, root);
  });
});
