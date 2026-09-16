import { useState } from 'react';
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

function safeStatus(field: PaymentFieldState): string {
  if (field.hint) return field.hint;
  if (field.source === 'database') return 'Configured in database.';
  if (field.source === 'environment') return 'Configured by environment.';
  return 'Not configured.';
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
  const [visible, setVisible] = useState(false);

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
            {markedForClear ? 'Database override marked for removal' : 'Remove database override'}
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
          aria-label={visible ? 'Hide candidate credential' : 'Show candidate credential'}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 disabled:opacity-50"
        >
          {visible ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
        </button>
      </div>
      <p className="text-xs text-gray-500">{safeStatus(field)}</p>
    </div>
  );
}
