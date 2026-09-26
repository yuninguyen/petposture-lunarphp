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
  onReveal?(): Promise<string>;
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
  onReveal,
}: SecretSettingInputProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [revealFailed, setRevealFailed] = useState(false);
  const canReveal = Boolean(onReveal) && field.source === 'database';
  const showingStored = visible && value === '' && revealed !== null && !markedForClear;

  const toggleVisible = async () => {
    if (visible) {
      setVisible(false);
      setRevealed(null);
      setRevealFailed(false);
      return;
    }
    setVisible(true);
    if (!canReveal || value !== '' || markedForClear) return;
    setRevealing(true);
    setRevealFailed(false);
    try {
      setRevealed(await onReveal!());
    } catch {
      setRevealFailed(true);
    } finally {
      setRevealing(false);
    }
  };
  const status = field.source === 'database'
    ? t('settings.secrets.hints.database')
    : field.source === 'environment'
      ? t('settings.secrets.hints.environment')
      : t('settings.secrets.hints.none');

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
              ? t('settings.secrets.undo_remove_override')
              : t('settings.secrets.remove_override')}
          </button>
        )}
      </div>
      <div className="relative">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          value={markedForClear ? '' : showingStored ? revealed! : value}
          disabled={disabled || markedForClear}
          readOnly={showingStored}
          autoComplete="new-password"
          onChange={(event) => onChange(event.target.value)}
          className="pr-10"
        />
        <button
          type="button"
          data-action="toggle-secret"
          disabled={disabled || markedForClear || revealing}
          onClick={() => void toggleVisible()}
          aria-label={visible
            ? t('settings.secrets.hide_candidate')
            : t('settings.secrets.show_candidate')}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 disabled:opacity-50"
        >
          {visible ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
        </button>
      </div>
      <p className="text-xs text-gray-500">{status}</p>
      {showingStored && <p className="text-xs text-gray-500">{t('settings.secrets.revealed_readonly')}</p>}
      {revealFailed && <p role="alert" className="text-xs text-red-600">{t('settings.secrets.reveal_failed')}</p>}
      {markedForClear && (
        <p role="alert" className="text-xs text-amber-700">
          {t('settings.secrets.clear_confirmation')}
        </p>
      )}
    </div>
  );
}
