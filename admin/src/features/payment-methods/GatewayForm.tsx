import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  testPaymentMethod,
  updatePaymentMethod,
  type PaymentGateway,
  type PaymentMethodState,
  type PaymentMethodTestResult,
} from './api';
import { SecretCredentialInput } from './SecretCredentialInput';

interface GatewayFieldDefinition {
  key: string;
  labelKey: string;
  fallbackLabel: string;
  secret: boolean;
  connectionField: boolean;
}

interface GatewayFormDefinition {
  modes: string[];
  fields: GatewayFieldDefinition[];
}

export interface GatewayFormProps {
  gateway: PaymentMethodState;
  webhookUrl: string;
  copyStatus: 'copied' | 'error' | null;
  onCopyWebhookUrl(): void;
  onSaved(next: PaymentMethodState): void;
}

const GATEWAY_FORMS: Record<PaymentGateway, GatewayFormDefinition> = {
  stripe: {
    modes: ['test', 'live'],
    fields: [
      { key: 'stripe_key', labelKey: 'payment_methods.fields.stripe_key', fallbackLabel: 'Publishable key', secret: false, connectionField: false },
      { key: 'stripe_secret', labelKey: 'payment_methods.fields.stripe_secret', fallbackLabel: 'Secret key', secret: true, connectionField: true },
      { key: 'stripe_webhook_secret', labelKey: 'payment_methods.fields.stripe_webhook_secret', fallbackLabel: 'Webhook signing secret', secret: true, connectionField: false },
    ],
  },
  paypal: {
    modes: ['sandbox', 'live'],
    fields: [
      { key: 'paypal_client_id', labelKey: 'payment_methods.fields.paypal_client_id', fallbackLabel: 'Client ID', secret: false, connectionField: true },
      { key: 'paypal_client_secret', labelKey: 'payment_methods.fields.paypal_client_secret', fallbackLabel: 'Client secret', secret: true, connectionField: true },
      { key: 'paypal_webhook_id', labelKey: 'payment_methods.fields.paypal_webhook_id', fallbackLabel: 'Webhook ID', secret: true, connectionField: false },
    ],
  },
  airwallex: {
    modes: ['sandbox', 'live'],
    fields: [
      { key: 'airwallex_client_id', labelKey: 'payment_methods.fields.airwallex_client_id', fallbackLabel: 'Client ID', secret: false, connectionField: true },
      { key: 'airwallex_api_key', labelKey: 'payment_methods.fields.airwallex_api_key', fallbackLabel: 'API key', secret: true, connectionField: true },
      { key: 'airwallex_webhook_secret', labelKey: 'payment_methods.fields.airwallex_webhook_secret', fallbackLabel: 'Webhook secret', secret: true, connectionField: false },
    ],
  },
  payoneer: {
    modes: ['sandbox', 'live'],
    fields: [
      { key: 'payoneer_merchant_code', labelKey: 'payment_methods.fields.payoneer_merchant_code', fallbackLabel: 'Merchant code', secret: false, connectionField: true },
      { key: 'payoneer_api_key', labelKey: 'payment_methods.fields.payoneer_api_key', fallbackLabel: 'API key', secret: true, connectionField: true },
      { key: 'payoneer_api_secret', labelKey: 'payment_methods.fields.payoneer_api_secret', fallbackLabel: 'API secret', secret: true, connectionField: true },
      { key: 'payoneer_webhook_secret', labelKey: 'payment_methods.fields.payoneer_webhook_secret', fallbackLabel: 'Webhook secret', secret: true, connectionField: false },
    ],
  },
};

function initialCandidates(gateway: PaymentMethodState, definition: GatewayFormDefinition): Record<string, string> {
  return Object.fromEntries(definition.fields.map((field) => [field.key, field.secret ? '' : gateway.fields[field.key]?.value ?? '']));
}

export function GatewayForm({ gateway, webhookUrl, copyStatus, onCopyWebhookUrl, onSaved }: GatewayFormProps) {
  const { t } = useTranslation();
  const definition = GATEWAY_FORMS[gateway.gateway];
  const clearWarning = t('payment_methods.clear_confirmation', { defaultValue: 'Remove database override — this field will fall back to environment configuration if available. This does not remove or disable the environment value.' });
  const [mode, setMode] = useState(gateway.mode);
  const [candidates, setCandidates] = useState<Record<string, string>>(() => initialCandidates(gateway, definition));
  const [clearFields, setClearFields] = useState<Set<string>>(new Set());
  const [connectionRevision, setConnectionRevision] = useState(0);
  const [testedRevision, setTestedRevision] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<PaymentMethodTestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMode(gateway.mode);
    setCandidates(initialCandidates(gateway, definition));
    setClearFields(new Set());
    setConnectionRevision(0);
    setTestedRevision(null);
    setTestResult(null);
    setError(null);
  }, [gateway, definition]);

  const changedFields = useMemo(() => {
    const fields: Record<string, string> = {};
    for (const field of definition.fields) {
      const candidate = candidates[field.key] ?? '';
      if (clearFields.has(field.key) || !candidate.trim()) continue;
      if (field.secret || candidate !== (gateway.fields[field.key]?.value ?? '')) fields[field.key] = candidate;
    }
    return fields;
  }, [candidates, clearFields, definition, gateway.fields]);

  const modeChanged = mode !== gateway.mode;
  const hasConnectionChanges = modeChanged || definition.fields.some(
    (field) => field.connectionField && Object.prototype.hasOwnProperty.call(changedFields, field.key),
  );
  const hasAnyChanges = modeChanged || Object.keys(changedFields).length > 0 || clearFields.size > 0;
  const hasUntestedConnectionChanges = hasConnectionChanges && testedRevision !== connectionRevision;
  const canSave = hasAnyChanges && !hasUntestedConnectionChanges && !isTesting && !isSaving;

  function changeMode(nextMode: string) {
    if (nextMode === mode) return;
    setMode(nextMode);
    setConnectionRevision((revision) => revision + 1);
    setTestResult(null);
  }

  function changeCandidate(field: GatewayFieldDefinition, value: string) {
    const previous = candidates[field.key] ?? '';
    if (previous === value) return;
    setCandidates((current) => ({ ...current, [field.key]: value }));
    setClearFields((current) => {
      if (!current.has(field.key)) return current;
      const next = new Set(current);
      next.delete(field.key);
      return next;
    });
    if (field.connectionField) {
      setConnectionRevision((revision) => revision + 1);
      setTestResult(null);
    }
  }

  function requestClear(field: GatewayFieldDefinition) {
    if (!window.confirm(clearWarning)) return;
    setCandidates((current) => ({ ...current, [field.key]: '' }));
    setClearFields((current) => new Set(current).add(field.key));
  }

  function undoClear(field: GatewayFieldDefinition) {
    setCandidates((current) => ({
      ...current,
      [field.key]: field.secret ? '' : gateway.fields[field.key]?.value ?? '',
    }));
    setClearFields((current) => {
      const next = new Set(current);
      next.delete(field.key);
      return next;
    });
  }

  async function testConnection() {
    setIsTesting(true);
    setError(null);
    const revision = connectionRevision;
    const fields = Object.fromEntries(
      definition.fields
        .filter((field) => field.connectionField && !clearFields.has(field.key) && (candidates[field.key] ?? '').trim())
        .map((field) => [field.key, candidates[field.key]]),
    );

    try {
      const response = await testPaymentMethod(gateway.gateway, {
        mode,
        ...(Object.keys(fields).length ? { fields } : {}),
      });
      setTestResult(response.data);
      setTestedRevision(revision);
    } catch (caught) {
      setTestResult(null);
      setTestedRevision(null);
      const rejected = caught instanceof Error && 'status' in caught && caught.status === 422;
      setError(rejected
        ? t('payment_methods.errors.provider_rejected', { defaultValue: 'The provider rejected the credentials.' })
        : t('payment_methods.errors.provider_unavailable', { defaultValue: 'The provider could not be reached. Try again.' }));
    } finally {
      setIsTesting(false);
    }
  }

  async function save() {
    if (!canSave) return;
    setIsSaving(true);
    setError(null);
    try {
      const response = await updatePaymentMethod(gateway.gateway, {
        ...(modeChanged ? { mode } : {}),
        ...(Object.keys(changedFields).length ? { fields: changedFields } : {}),
        ...(clearFields.size ? { clear_fields: Array.from(clearFields) } : {}),
      });
      setCandidates(initialCandidates(response.data, definition));
      setClearFields(new Set());
      setConnectionRevision(0);
      setTestedRevision(null);
      setTestResult(null);
      onSaved(response.data);
    } catch {
      setError(t('payment_methods.errors.save_failed', { defaultValue: 'Payment method could not be saved.' }));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <div data-testid="mode-webhook-row" className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="space-y-2 sm:w-48">
          <label htmlFor={`${gateway.gateway}-mode`} className="text-sm font-medium text-ink">
            {t('payment_methods.mode', { defaultValue: 'Mode' })}
          </label>
          <select
            id={`${gateway.gateway}-mode`}
            value={mode}
            disabled={isTesting || isSaving}
            onChange={(event) => changeMode(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {definition.modes.map((option) => (
              <option key={option} value={option}>
                {t(`payment_methods.modes.${option}`, { defaultValue: option })}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <label htmlFor={`${gateway.gateway}-webhook-url`} className="text-sm font-medium text-slate-700">
            {t('payment_methods.webhook_url', { defaultValue: 'Webhook URL' })}
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id={`${gateway.gateway}-webhook-url`}
              type="text"
              readOnly
              value={webhookUrl}
              className="min-w-0 flex-1 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700"
            />
            <button
              type="button"
              onClick={onCopyWebhookUrl}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {t('payment_methods.copy_webhook_url', { defaultValue: 'Copy webhook URL' })}
            </button>
          </div>
          {copyStatus === 'copied' && <p role="status" className="text-sm text-green-700">{t('payment_methods.webhook_copied', { defaultValue: 'Webhook URL copied.' })}</p>}
          {copyStatus === 'error' && <p role="alert" className="text-sm text-red-600">{t('payment_methods.webhook_copy_error', { defaultValue: 'Webhook URL could not be copied.' })}</p>}
        </div>
      </div>

      {definition.fields.map((field) => {
        const fieldState = gateway.fields[field.key] ?? { configured: false, source: 'none' as const };
        const label = t(field.labelKey, { defaultValue: field.fallbackLabel });
        if (field.secret) {
          return (
            <SecretCredentialInput
              key={field.key}
              id={`${gateway.gateway}-${field.key}`}
              label={label}
              value={candidates[field.key] ?? ''}
              field={fieldState}
              disabled={isTesting || isSaving}
              markedForClear={clearFields.has(field.key)}
              onChange={(value) => changeCandidate(field, value)}
              onRequestClear={() => requestClear(field)}
              onUndoClear={() => undoClear(field)}
            />
          );
        }
        const markedForClear = clearFields.has(field.key);
        return (
          <div key={field.key} className="space-y-2">
            <label htmlFor={`${gateway.gateway}-${field.key}`} className="text-sm font-medium text-ink">{label}</label>
            <Input
              id={`${gateway.gateway}-${field.key}`}
              value={candidates[field.key] ?? ''}
              disabled={isTesting || isSaving || markedForClear}
              onChange={(event) => changeCandidate(field, event.target.value)}
            />
            {fieldState.source === 'database' && (
              <Button
                type="button"
                variant="secondary"
                data-action={markedForClear ? 'undo-remove-override' : 'remove-override'}
                data-field={field.key}
                disabled={isTesting || isSaving}
                onClick={() => markedForClear ? undoClear(field) : requestClear(field)}
              >
                {markedForClear
                  ? t('payment_methods.undo_remove_override', { defaultValue: 'Undo removal' })
                  : t('payment_methods.remove_override', { defaultValue: 'Remove database override' })}
              </Button>
            )}
            {markedForClear && <p role="alert" className="text-sm text-amber-700">{clearWarning}</p>}
          </div>
        );
      })}

      {gateway.gateway === 'payoneer' && (
        <p className="text-sm text-amber-700">
          {t('payment_methods.payoneer_test_limitation', { defaultValue: 'Payoneer can confirm that credentials are present, but cannot verify connectivity.' })}
        </p>
      )}
      {testResult && <p role="status" className="text-sm text-green-700">{testResult.status === 'credentials_present'
        ? t('payment_methods.payoneer_credentials_present', { defaultValue: 'Required credentials are present. Full Payoneer connectivity is not verified.' })
        : testResult.message}</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <Button type="button" variant="secondary" disabled={isTesting || isSaving} onClick={() => void testConnection()}>
          {isTesting ? t('payment_methods.testing', { defaultValue: 'Testing…' }) : t('payment_methods.test', { defaultValue: 'Test connection' })}
        </Button>
        <Button type="submit" disabled={!canSave}>
          {isSaving ? t('payment_methods.saving', { defaultValue: 'Saving…' }) : t('payment_methods.save', { defaultValue: 'Save' })}
        </Button>
      </div>
    </form>
  );
}
