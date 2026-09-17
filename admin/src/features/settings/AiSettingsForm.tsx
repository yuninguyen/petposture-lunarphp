import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  fetchAiModels,
  fetchAiSettings,
  updateAiSettings,
  type AiCandidateFields,
  type AiModelFetchPayload,
  type AiProvider,
  type AiSettingsFields,
  type AiSettingsPayload,
  type AiSettingsState,
} from './api';
import { SecretSettingInput } from './SecretSettingInput';

const QUERY_KEY = ['admin', 'settings', 'ai'] as const;
type AiField = keyof AiSettingsFields;
type EditableValues = Record<AiField, string>;
type FetchError = 'rejected' | 'unavailable' | null;

const SECRET_FIELDS = new Set<AiField>(['anthropic_api_key', 'openai_api_key', 'xai_api_key', 'gemini_api_key']);
const OPENAI_FIELDS = new Set<AiField>(['openai_api_key', 'openai_base_url', 'openai_model']);
const FIELD_DEFINITIONS: Array<{
  key: AiField;
  labelKey: string;
  type: 'text' | 'secret' | 'provider' | 'model';
}> = [
  { key: 'ai_seo_provider', labelKey: 'settings_ai.ai_seo_provider', type: 'provider' },
  { key: 'anthropic_api_key', labelKey: 'settings_ai.anthropic_api_key', type: 'secret' },
  { key: 'anthropic_model', labelKey: 'settings_ai.anthropic_model', type: 'text' },
  { key: 'openai_api_key', labelKey: 'settings_ai.openai_api_key', type: 'secret' },
  { key: 'openai_model', labelKey: 'settings_ai.openai_model', type: 'model' },
  { key: 'openai_base_url', labelKey: 'settings_ai.openai_base_url', type: 'text' },
  { key: 'xai_api_key', labelKey: 'settings_ai.xai_api_key', type: 'secret' },
  { key: 'xai_model', labelKey: 'settings_ai.xai_model', type: 'text' },
  { key: 'gemini_api_key', labelKey: 'settings_ai.gemini_api_key', type: 'secret' },
  { key: 'gemini_model', labelKey: 'settings_ai.gemini_model', type: 'text' },
];

function baselineValue(state: AiSettingsState, field: AiField): string {
  if (SECRET_FIELDS.has(field)) return '';
  const value = (state.fields[field] as AiSettingsFields[Exclude<AiField, keyof Pick<AiSettingsFields, 'anthropic_api_key' | 'openai_api_key' | 'xai_api_key' | 'gemini_api_key'>>]).value;
  return value ?? '';
}

function initialValues(state: AiSettingsState): EditableValues {
  return Object.fromEntries(FIELD_DEFINITIONS.map(({ key }) => [key, baselineValue(state, key)])) as EditableValues;
}

function statusOf(error: unknown): number | null {
  if (typeof error !== 'object' || error === null || !('status' in error)) return null;
  return typeof error.status === 'number' ? error.status : null;
}

export function AiSettingsForm() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: async () => (await fetchAiSettings()).data });
  const [baseline, setBaseline] = useState<AiSettingsState | null>(null);
  const [values, setValues] = useState<EditableValues | null>(null);
  const [clearFields, setClearFields] = useState<Set<AiField>>(new Set());
  const [openAiRevision, setOpenAiRevision] = useState(0);
  const [fetchedRevision, setFetchedRevision] = useState<number | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [fetchError, setFetchError] = useState<FetchError>(null);
  const [modelError, setModelError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fetchRequestRef = useRef(0);
  const saveRequestRef = useRef(0);
  const fetchLockRef = useRef(false);
  const saveLockRef = useRef(false);

  const adoptServerState = (state: AiSettingsState) => {
    setBaseline(state);
    setValues(initialValues(state));
    setClearFields(new Set());
    setOpenAiRevision(0);
    setFetchedRevision(null);
    setModels([]);
    setFetchError(null);
    setModelError(false);
    setSaveError(false);
  };

  const payload = useMemo<AiSettingsPayload>(() => {
    if (!baseline || !values) return {};
    const fields: AiCandidateFields = {};
    for (const { key } of FIELD_DEFINITIONS) {
      const value = values[key];
      if (clearFields.has(key) || value.trim() === '') continue;
      if (SECRET_FIELDS.has(key) || value !== baselineValue(baseline, key)) {
        Object.assign(fields, { [key]: value });
      }
    }
    return {
      ...(Object.keys(fields).length > 0 ? { fields } : {}),
      ...(clearFields.size > 0 ? { clear_fields: Array.from(clearFields) } : {}),
    };
  }, [baseline, clearFields, values]);

  const openAiPayload = useMemo<AiModelFetchPayload>(() => {
    const fields = Object.fromEntries(Object.entries(payload.fields ?? {}).filter(([key]) => OPENAI_FIELDS.has(key as AiField))) as NonNullable<AiModelFetchPayload['fields']>;
    const clears = (payload.clear_fields ?? []).filter((key): key is 'openai_api_key' | 'openai_base_url' | 'openai_model' => OPENAI_FIELDS.has(key));
    return {
      ...(Object.keys(fields).length > 0 ? { fields } : {}),
      ...(clears.length > 0 ? { clear_fields: clears } : {}),
    };
  }, [payload]);

  const hasChanges = Boolean(payload.fields && Object.keys(payload.fields).length > 0) || Boolean(payload.clear_fields?.length);
  const hasOpenAiChanges = Boolean(openAiPayload.fields && Object.keys(openAiPayload.fields).length > 0) || Boolean(openAiPayload.clear_fields?.length);
  const effectiveModel = clearFields.has('openai_model') ? '' : (values?.openai_model ?? '');
  const modelIsAllowed = effectiveModel === '' || models.includes(effectiveModel);
  const currentFetchSucceeded = hasOpenAiChanges && fetchedRevision === openAiRevision && modelIsAllowed;
  const maySave = hasChanges && (!hasOpenAiChanges || currentFetchSucceeded);
  const pending = isFetching || isSaving;
  const modelOptions = Array.from(new Set([...(effectiveModel ? [effectiveModel] : []), ...models])).sort();

  useEffect(() => {
    if (!query.data || pending) return;
    if (!baseline || (!hasChanges && query.data !== baseline)) adoptServerState(query.data);
  }, [baseline, hasChanges, pending, query.data]);

  const invalidateOpenAiFetch = () => {
    setOpenAiRevision((revision) => revision + 1);
    setFetchedRevision(null);
    setFetchError(null);
    setModelError(false);
    fetchRequestRef.current += 1;
    fetchLockRef.current = false;
    setIsFetching(false);
  };

  const changeValue = (field: AiField, value: string) => {
    if (!values || values[field] === value) return;
    setValues({ ...values, [field]: value });
    setClearFields((current) => {
      if (!current.has(field)) return current;
      const next = new Set(current);
      next.delete(field);
      return next;
    });
    if (OPENAI_FIELDS.has(field)) invalidateOpenAiFetch();
    setSaveError(false);
    setSaved(false);
  };

  const clearWarning = t('settings.secrets.clear_confirmation');

  const requestClear = (field: AiField) => {
    if (!window.confirm(clearWarning) || !values) return;
    setValues({ ...values, [field]: '' });
    setClearFields((current) => new Set(current).add(field));
    if (OPENAI_FIELDS.has(field)) invalidateOpenAiFetch();
    setSaveError(false);
    setSaved(false);
  };

  const undoClear = (field: AiField) => {
    if (!baseline || !values) return;
    setValues({ ...values, [field]: baselineValue(baseline, field) });
    setClearFields((current) => {
      const next = new Set(current);
      next.delete(field);
      return next;
    });
    if (OPENAI_FIELDS.has(field)) invalidateOpenAiFetch();
    setSaveError(false);
    setSaved(false);
  };

  async function loadModels() {
    if (fetchLockRef.current || isSaving) return;
    const requestId = fetchRequestRef.current + 1;
    fetchRequestRef.current = requestId;
    fetchLockRef.current = true;
    const revision = openAiRevision;
    setIsFetching(true);
    setFetchError(null);
    setModelError(false);
    try {
      const { data } = await fetchAiModels(openAiPayload);
      if (requestId !== fetchRequestRef.current) return;
      const nextModels = Array.from(new Set(data.models.filter((model) => model.trim() !== ''))).sort();
      setModels(nextModels);
      setFetchedRevision(revision);
      setModelError(effectiveModel !== '' && !nextModels.includes(effectiveModel));
    } catch (error) {
      if (requestId !== fetchRequestRef.current) return;
      setFetchedRevision(null);
      setModels([]);
      setFetchError(statusOf(error) === 422 ? 'rejected' : 'unavailable');
    } finally {
      if (requestId === fetchRequestRef.current) {
        fetchLockRef.current = false;
        setIsFetching(false);
      }
    }
  }

  async function save() {
    if (saveLockRef.current || !maySave || pending) return;
    const requestId = saveRequestRef.current + 1;
    saveRequestRef.current = requestId;
    saveLockRef.current = true;
    setIsSaving(true);
    setSaveError(false);
    try {
      const { data } = await updateAiSettings(payload);
      if (requestId !== saveRequestRef.current) return;
      queryClient.setQueryData<AiSettingsState>(QUERY_KEY, data);
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

  if (query.isLoading || (query.data && (!baseline || !values))) {
    return <p role="status" className="text-sm text-slate-500">{t('settings_ai.loading')}</p>;
  }
  if (query.isError || !query.data || !baseline || !values) {
    return <p role="alert" className="text-sm text-red-600">{t('settings_ai.load_error')}</p>;
  }

  return (
    <form className="space-y-6" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <div className="grid gap-6 md:grid-cols-2">
        {FIELD_DEFINITIONS.map(({ key, labelKey, type }) => {
          const state = baseline.fields[key];
          const markedForClear = clearFields.has(key);
          const label = t(labelKey);
          if (type === 'secret') {
            return <SecretSettingInput key={key} id={`ai-${key}`} label={label} value={values[key]} field={state} disabled={pending} markedForClear={markedForClear} onChange={(value) => changeValue(key, value)} onRequestClear={() => requestClear(key)} onUndoClear={() => undoClear(key)} />;
          }
          return (
            <div key={key} className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor={`ai-${key}`} className="text-sm font-medium text-ink">{label}</label>
                {state.source === 'database' && (
                  <button type="button" data-action={markedForClear ? 'undo-remove-override' : 'remove-override'} data-field={key} disabled={pending} onClick={() => markedForClear ? undoClear(key) : requestClear(key)} className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50">
                    {markedForClear ? t('settings.secrets.undo_remove_override') : t('settings.secrets.remove_override')}
                  </button>
                )}
              </div>
              {type === 'provider' ? (
                <select id={`ai-${key}`} value={markedForClear ? '' : values[key]} disabled={pending || markedForClear} onChange={(event) => changeValue(key, event.target.value as AiProvider)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
                  {(['auto', 'anthropic', 'openai', 'grok', 'gemini'] as AiProvider[]).map((provider) => <option key={provider} value={provider}>{t(`settings_ai.providers.${provider}`)}</option>)}
                </select>
              ) : type === 'model' ? (
                <select id={`ai-${key}`} value={markedForClear ? '' : values[key]} disabled={pending || markedForClear} onChange={(event) => changeValue(key, event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
                  {!effectiveModel && <option value="">{t('settings_ai.openai_model_empty')}</option>}
                  {modelOptions.map((model) => <option key={model} value={model}>{model}</option>)}
                </select>
              ) : (
                <Input id={`ai-${key}`} value={markedForClear ? '' : values[key]} disabled={pending || markedForClear} onChange={(event) => changeValue(key, event.target.value)} />
              )}
              <p className="text-xs text-gray-500">{t(`settings.secrets.hints.${state.source}`)}</p>
              {markedForClear && <p role="alert" className="text-xs text-amber-700">{clearWarning}</p>}
            </div>
          );
        })}
      </div>

      {modelError && <p role="alert" className="text-sm text-red-600">{t('settings_ai.errors.model_not_found')}</p>}
      {fetchError === 'rejected' && <p role="alert" className="text-sm text-red-600">{t('settings_ai.errors.rejected')}</p>}
      {fetchError === 'unavailable' && <p role="alert" className="text-sm text-red-600">{t('settings_ai.errors.unavailable')}</p>}
      {currentFetchSucceeded && <p role="status" className="text-sm text-green-700">{t('settings_ai.fetch_success')}</p>}
      {saveError && <p role="alert" className="text-sm text-red-600">{t('settings_ai.errors.save_failed')}</p>}
      {saved && <p role="status" className="text-sm text-green-700">{t('settings_ai.save_success')}</p>}

      <div className="flex gap-3">
        <Button type="button" variant="secondary" disabled={pending} onClick={() => void loadModels()}>
          {isFetching ? t('settings_ai.fetching') : t('settings_ai.fetch_models')}
        </Button>
        <Button type="submit" disabled={!maySave || pending}>
          {isSaving ? t('settings_ai.saving') : t('settings_ai.save')}
        </Button>
      </div>
    </form>
  );
}
