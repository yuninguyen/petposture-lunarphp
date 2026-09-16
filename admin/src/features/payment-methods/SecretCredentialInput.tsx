import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EyeIcon, EyeOffIcon } from '@/components/ui/icons';
import { Input } from '@/components/ui/input';
import type { PaymentFieldState } from './api';

export interface SecretCredentialInputProps {
  id: string;
  label: string;
  value: string;
  field: PaymentFieldState;
  disabled?: boolean;
  markedForClear: boolean;
  onChange(value: string): void;
  onRequestClear(): void;
}

export function SecretCredentialInput({
  id,
  label,
  value,
  field,
  disabled = false,
  markedForClear,
  onChange,
  onRequestClear,
}: SecretCredentialInputProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const status = field.source === 'database'
    ? t('payment_methods.hints.configured_database', { defaultValue: 'Configured in database.' })
    : field.source === 'environment'
      ? t('payment_methods.hints.configured_environment', { defaultValue: 'Configured by environment.' })
      : t('payment_methods.hints.not_configured', { defaultValue: 'Not configured.' });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>
        {field.source === 'database' && (
          <button
            type="button"
            data-action="remove-override"
            disabled={disabled || markedForClear}
            onClick={onRequestClear}
            className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
          >
            {markedForClear
              ? t('payment_methods.override_marked_for_removal', { defaultValue: 'Database override marked for removal' })
              : t('payment_methods.remove_override', { defaultValue: 'Remove database override' })}
          </button>
        )}
      </div>
      <div className="relative">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          disabled={disabled || markedForClear}
          autoComplete="new-password"
          onChange={(event) => onChange(event.target.value)}
          className="pr-10"
        />
        <button
          type="button"
          data-action="toggle-secret"
          disabled={disabled || markedForClear}
          onClick={() => setVisible((current) => !current)}
          aria-label={visible
            ? t('payment_methods.hide_candidate_credential', { defaultValue: 'Hide candidate credential' })
            : t('payment_methods.show_candidate_credential', { defaultValue: 'Show candidate credential' })}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 disabled:opacity-50"
        >
          {visible ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
        </button>
      </div>
      <p className="text-xs text-gray-500">{status}</p>
      {markedForClear && (
        <p role="alert" className="text-xs text-amber-700">
          {t('payment_methods.clear_confirmation', { defaultValue: 'Remove database override — this field will fall back to environment configuration if available. This does not remove or disable the environment value.' })}
        </p>
      )}
    </div>
  );
}
