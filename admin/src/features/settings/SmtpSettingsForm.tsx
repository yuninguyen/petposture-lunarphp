import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  fetchSmtpSettings,
  testSmtpSettings,
  updateSmtpSettings,
  type SmtpCandidateFields,
  type SmtpSettingsFields,
  type SmtpSettingsPayload,
  type SmtpSettingsState,
} from './api';
import { SecretSettingInput } from './SecretSettingInput';

const QUERY_KEY = ['admin', 'settings', 'smtp'] as const;
type SmtpField = keyof SmtpSettingsFields;
type EditableValues = Record<Exclude<SmtpField, 'smtp_pass'>, string> & { smtp_pass: string };

const FIELD_DEFINITIONS: Array<{
  key: SmtpField;
  labelKey: string;
  fallbackLabel: string;
  type: 'text' | 'number' | 'select' | 'secret';
}> = [
  { key: 'smtp_host', labelKey: 'settings_smtp.smtp_host', fallbackLabel: 'SMTP host', type: 'text' },
  { key: 'smtp_port', labelKey: 'settings_smtp.smtp_port', fallbackLabel: 'SMTP port', type: 'number' },
  { key: 'smtp_user', labelKey: 'settings_smtp.smtp_user', fallbackLabel: 'SMTP username', type: 'text' },
  { key: 'smtp_pass', labelKey: 'settings_smtp.smtp_pass', fallbackLabel: 'SMTP password', type: 'secret' },
  { key: 'smtp_encryption', labelKey: 'settings_smtp.smtp_encryption', fallbackLabel: 'Encryption', type: 'select' },
  { key: 'mail_from_address', labelKey: 'settings_smtp.mail_from_address', fallbackLabel: 'From address', type: 'text' },
];

function initialValues(state: SmtpSettingsState): EditableValues {
  return {
    smtp_host: state.fields.smtp_host.value ?? '',
    smtp_port: state.fields.smtp_port.value === null ? '' : String(state.fields.smtp_port.value),
    smtp_user: state.fields.smtp_user.value ?? '',
    smtp_pass: '',
    smtp_encryption: state.fields.smtp_encryption.value ?? '',
    mail_from_address: state.fields.mail_from_address.value ?? '',
  };
}

function baselineValue(state: SmtpSettingsState, field: SmtpField): string {
  if (field === 'smtp_pass') return '';
  const value = state.fields[field].value;
  return value === null ? '' : String(value);
}

function candidateValue(field: SmtpField, value: string): string | number {
  return field === 'smtp_port' ? Number(value) : value;
}

function statusOf(error: unknown): number | null {
  if (typeof error !== 'object' || error === null || !('status' in error)) return null;
  return typeof error.status === 'number' ? error.status : null;
}

export function SmtpSettingsForm() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => (await fetchSmtpSettings()).data,
  });
  const [baseline, setBaseline] = useState<SmtpSettingsState | null>(null);
  const [values, setValues] = useState<EditableValues | null>(null);
  const [clearFields, setClearFields] = useState<Set<SmtpField>>(new Set());
  const [connectionRevision, setConnectionRevision] = useState(0);
  const [testedRevision, setTestedRevision] = useState<number | null>(null);
  const [testSucceeded, setTestSucceeded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testError, setTestError] = useState<'rejected' | 'unavailable' | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const testRequestRef = useRef(0);
  const saveRequestRef = useRef(0);
  const testLockRef = useRef(false);
  const saveLockRef = useRef(false);

  const adoptServerState = (state: SmtpSettingsState) => {
    setBaseline(state);
    setValues(initialValues(state));
    setClearFields(new Set());
    setConnectionRevision(0);
    setTestedRevision(null);
    setTestSucceeded(false);
    setTestError(null);
    setSaveError(false);
  };

  const payload = useMemo<SmtpSettingsPayload>(() => {
    if (!baseline || !values) return {};
    const fields: SmtpCandidateFields = {};
    for (const definition of FIELD_DEFINITIONS) {
      const { key } = definition;
      const value = values[key];
      if (clearFields.has(key) || value.trim() === '') continue;
      if (key === 'smtp_pass' || value !== baselineValue(baseline, key)) {
        Object.assign(fields, { [key]: candidateValue(key, value) });
      }
    }
    return {
      ...(Object.keys(fields).length > 0 ? { fields } : {}),
      ...(clearFields.size > 0 ? { clear_fields: Array.from(clearFields) } : {}),
    };
  }, [baseline, clearFields, values]);

  const hasChanges = Boolean(payload.fields && Object.keys(payload.fields).length > 0)
    || Boolean(payload.clear_fields?.length);
  const currentRevisionTested = hasChanges && testedRevision === connectionRevision && testSucceeded;
  const pending = isTesting || isSaving;

  useEffect(() => {
    if (!query.data || pending) return;
    if (!baseline || (!hasChanges && query.data !== baseline)) adoptServerState(query.data);
  }, [baseline, hasChanges, pending, query.data]);

  async function testConnection() {
    if (testLockRef.current || isSaving) return;
    const requestId = testRequestRef.current + 1;
    testRequestRef.current = requestId;
    testLockRef.current = true;
    const revision = connectionRevision;
    setIsTesting(true);
    setTestError(null);
    setTestSucceeded(false);
    try {
      await testSmtpSettings(payload);
      if (requestId !== testRequestRef.current) return;
      setTestedRevision(revision);
      setTestSucceeded(true);
    } catch (error) {
      if (requestId !== testRequestRef.current) return;
      setTestedRevision(null);
      setTestSucceeded(false);
      setTestError(statusOf(error) === 422 ? 'rejected' : 'unavailable');
    } finally {
      if (requestId === testRequestRef.current) {
        testLockRef.current = false;
        setIsTesting(false);
      }
    }
  }

  async function save() {
    if (saveLockRef.current || !hasChanges || !currentRevisionTested || pending) return;
    const requestId = saveRequestRef.current + 1;
    saveRequestRef.current = requestId;
    saveLockRef.current = true;
    setIsSaving(true);
    setSaveError(false);
    try {
      const { data } = await updateSmtpSettings(payload);
      if (requestId !== saveRequestRef.current) return;
      queryClient.setQueryData<SmtpSettingsState>(QUERY_KEY, data);
      adoptServerState(data);
      setSaved(true);
    } catch {
      if (requestId === saveRequestRef.current) setSaveError(true);
    } finally {
      if (requestId === saveRequestRef.current) {
        saveLockRef.current = false;
        setIsSaving(false);
      }
    }
  }
  const clearWarning = t('settings.secrets.clear_confirmation', {
    defaultValue: 'Remove database override — this field will fall back to environment configuration if available. This does not remove or disable the environment value.',
  });

  const invalidateTest = () => {
    setConnectionRevision((revision) => revision + 1);
    setTestedRevision(null);
    setTestSucceeded(false);
    testRequestRef.current += 1;
    testLockRef.current = false;
    setIsTesting(false);
    setTestError(null);
    setSaveError(false);
    setSaved(false);
  };

  const changeValue = (field: SmtpField, value: string) => {
    if (!values || values[field] === value) return;
    setValues({ ...values, [field]: value });
    setClearFields((current) => {
      if (!current.has(field)) return current;
      const next = new Set(current);
      next.delete(field);
      return next;
    });
    invalidateTest();
  };

  const requestClear = (field: SmtpField) => {
    if (!window.confirm(clearWarning) || !values) return;
    setValues({ ...values, [field]: '' });
    setClearFields((current) => new Set(current).add(field));
    invalidateTest();
  };

  const undoClear = (field: SmtpField) => {
    if (!baseline || !values) return;
    setValues({ ...values, [field]: baselineValue(baseline, field) });
    setClearFields((current) => {
      const next = new Set(current);
      next.delete(field);
      return next;
    });
    invalidateTest();
  };

  if (query.isLoading || (query.data && (!baseline || !values))) {
    return <p role="status" className="text-sm text-slate-500">{t('settings_smtp.loading', { defaultValue: 'Loading SMTP settings…' })}</p>;
  }
  if (query.isError || !query.data || !baseline || !values) {
    return <p role="alert" className="text-sm text-red-600">{t('settings_smtp.load_error', { defaultValue: 'SMTP settings could not be loaded.' })}</p>;
  }

  return (
    <form className="space-y-6" onSubmit={(event) => {
      event.preventDefault();
      void save();
    }}>
      <p className="text-sm text-slate-600">
        {t('settings_smtp.test_recipient', { defaultValue: 'The test email is sent only to your signed-in administrator email address.' })}
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        {FIELD_DEFINITIONS.map((definition) => {
          const { key } = definition;
          const state = baseline.fields[key];
          const markedForClear = clearFields.has(key);
          const label = t(definition.labelKey, { defaultValue: definition.fallbackLabel });
          if (definition.type === 'secret') {
            return (
              <SecretSettingInput
                key={key}
                id={`smtp-${key}`}
                label={label}
                value={values[key]}
                field={state}
                disabled={pending}
                markedForClear={markedForClear}
                onChange={(value) => changeValue(key, value)}
                onRequestClear={() => requestClear(key)}
                onUndoClear={() => undoClear(key)}
              />
            );
          }
          return (
            <div key={key} className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor={`smtp-${key}`} className="text-sm font-medium text-ink">{label}</label>
                {state.source === 'database' && (
                  <button
                    type="button"
                    data-action={markedForClear ? 'undo-remove-override' : 'remove-override'}
                    data-field={key}
                    disabled={pending}
                    onClick={() => markedForClear ? undoClear(key) : requestClear(key)}
                    className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                  >
                    {markedForClear
                      ? t('settings.secrets.undo_remove_override', { defaultValue: 'Undo removal' })
                      : t('settings.secrets.remove_override', { defaultValue: 'Remove database override' })}
                  </button>
                )}
              </div>
              {definition.type === 'select' ? (
                <select
                  id={`smtp-${key}`}
                  value={markedForClear ? '' : values[key]}
                  disabled={pending || markedForClear}
                  onChange={(event) => changeValue(key, event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">{t('settings_smtp.encryption.none_selected', { defaultValue: 'Select encryption' })}</option>
                  <option value="tls">TLS</option>
                  <option value="ssl">SSL</option>
                  <option value="none">{t('settings_smtp.encryption.none', { defaultValue: 'None' })}</option>
                </select>
              ) : (
                <Input
                  id={`smtp-${key}`}
                  type={definition.type}
                  min={definition.type === 'number' ? 1 : undefined}
                  max={definition.type === 'number' ? 65535 : undefined}
                  value={markedForClear ? '' : values[key]}
                  disabled={pending || markedForClear}
                  onChange={(event) => changeValue(key, event.target.value)}
                />
              )}
              <p className="text-xs text-gray-500">{state.hint}</p>
              {markedForClear && <p role="alert" className="text-xs text-amber-700">{clearWarning}</p>}
            </div>
          );
        })}
      </div>

      {currentRevisionTested && <p role="status" className="text-sm text-green-700">{t('settings_smtp.test_success', { defaultValue: 'SMTP test email sent successfully.' })}</p>}
      {testError === 'rejected' && <p role="alert" className="text-sm text-red-600">{t('settings_smtp.errors.rejected', { defaultValue: 'The SMTP server rejected these settings.' })}</p>}
      {testError === 'unavailable' && <p role="alert" className="text-sm text-red-600">{t('settings_smtp.errors.unavailable', { defaultValue: 'The SMTP server could not be reached. Try again.' })}</p>}
      {saveError && <p role="alert" className="text-sm text-red-600">{t('settings_smtp.errors.save_failed', { defaultValue: 'SMTP settings could not be saved.' })}</p>}
      {saved && <p role="status" className="text-sm text-green-700">{t('settings_smtp.save_success', { defaultValue: 'SMTP settings saved.' })}</p>}

      <div className="flex gap-3">
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => void testConnection()}
        >
          {isTesting ? t('settings_smtp.testing', { defaultValue: 'Testing…' }) : t('settings_smtp.test', { defaultValue: 'Send test email' })}
        </Button>
        <Button type="submit" disabled={!hasChanges || !currentRevisionTested || pending}>
          {isSaving ? t('settings_smtp.saving', { defaultValue: 'Saving…' }) : t('settings_smtp.save', { defaultValue: 'Save' })}
        </Button>
      </div>
    </form>
  );
}
