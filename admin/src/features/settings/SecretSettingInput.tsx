import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EyeIcon, EyeOffIcon } from '@/components/ui/icons';
import { Input } from '@/components/ui/input';
import type { SafeSecretField } from './api';

export interface SecretSettingInputProps {
  id: string;
  label: string;
  value: string;
  field: SafeSecretField;
  disabled?: boolean;
  markedForClear: boolean;
  onChange(value: string): void;
  onRequestClear(): void;
  onUndoClear(): void;
}

export function SecretSettingInput({
  id,
  label,
  value,
  field,
  disabled = false,
  markedForClear,
  onChange,
  onRequestClear,
  onUndoClear,
}: SecretSettingInputProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const status = field.source === 'database'
    ? t('settings.secrets.hints.database', { defaultValue: 'Configured in database.' })
    : field.source === 'environment'
      ? t('settings.secrets.hints.environment', { defaultValue: 'Configured by environment.' })
      : t('settings.secrets.hints.none', { defaultValue: 'Not configured.' });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>
        {field.source === 'database' && (
          <button
            type="button"
            data-action={markedForClear ? 'undo-remove-override' : 'remove-override'}
            disabled={disabled}
            onClick={markedForClear ? onUndoClear : onRequestClear}
            className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
          >
            {markedForClear
              ? t('settings.secrets.undo_remove_override', { defaultValue: 'Undo removal' })
              : t('settings.secrets.remove_override', { defaultValue: 'Remove database override' })}
          </button>
        )}
      </div>
      <div className="relative">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          value={markedForClear ? '' : value}
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
            ? t('settings.secrets.hide_candidate', { defaultValue: 'Hide candidate credential' })
            : t('settings.secrets.show_candidate', { defaultValue: 'Show candidate credential' })}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 disabled:opacity-50"
        >
          {visible ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
        </button>
      </div>
      <p className="text-xs text-gray-500">{status}</p>
      {markedForClear && (
        <p role="alert" className="text-xs text-amber-700">
          {t('settings.secrets.clear_confirmation', {
            defaultValue: 'Remove database override — this field will fall back to environment configuration if available. This does not remove or disable the environment value.',
          })}
        </p>
      )}
    </div>
  );
}
