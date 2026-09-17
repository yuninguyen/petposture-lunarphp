import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  fetchAnalyticsSettings,
  updateAnalyticsSettings,
  type AnalyticsSettingsState,
  type AnalyticsSettingsUpdatePayload,
} from './api';

const QUERY_KEY = ['admin', 'settings', 'analytics'] as const;

export function AnalyticsSettingsForm() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => (await fetchAnalyticsSettings()).data,
  });
  const [baseline, setBaseline] = useState<AnalyticsSettingsState | null>(null);
  const [analyticsId, setAnalyticsId] = useState('');
  const [saved, setSaved] = useState(false);

  const adoptServerState = (data: AnalyticsSettingsState) => {
    setBaseline(data);
    setAnalyticsId(data.google_analytics_id ?? '');
  };

  useEffect(() => {
    if (query.data && !baseline) adoptServerState(query.data);
  }, [baseline, query.data]);

  const changed = Boolean(baseline) && analyticsId !== (baseline?.google_analytics_id ?? '');
  const payload: AnalyticsSettingsUpdatePayload = changed
    ? { google_analytics_id: analyticsId || null }
    : {};
  const mutation = useMutation({
    mutationFn: (next: AnalyticsSettingsUpdatePayload) => updateAnalyticsSettings(next),
    onSuccess: ({ data }) => {
      queryClient.setQueryData<AnalyticsSettingsState>(QUERY_KEY, data);
      adoptServerState(data);
      setSaved(true);
    },
  });

  if (query.isLoading || (query.data && !baseline)) {
    return <p role="status" className="text-sm text-slate-500">{t('settings_analytics.loading', { defaultValue: 'Loading analytics settings…' })}</p>;
  }
  if (query.isError || !query.data || !baseline) {
    return <p role="alert" className="text-sm text-red-600">{t('settings_analytics.load_error', { defaultValue: 'Analytics settings could not be loaded.' })}</p>;
  }

  return (
    <form className="space-y-6" onSubmit={(event) => { event.preventDefault(); setSaved(false); mutation.reset(); if (changed) mutation.mutate(payload); }}>
      <div className="space-y-2">
        <label htmlFor="google_analytics_id" className="text-sm font-medium text-ink">{t('settings_analytics.google_analytics_id', { defaultValue: 'Google Analytics ID' })}</label>
        <Input id="google_analytics_id" value={analyticsId} disabled={mutation.isPending} onChange={(event) => { setSaved(false); mutation.reset(); setAnalyticsId(event.target.value); }} />
      </div>
      {mutation.isError && <p role="alert" className="text-sm text-red-600">{t('settings_analytics.save_error', { defaultValue: 'Analytics settings could not be saved.' })}</p>}
      {saved && <p role="status" className="text-sm text-green-700">{t('settings_analytics.save_success', { defaultValue: 'Analytics settings saved.' })}</p>}
      <Button type="submit" disabled={!changed || mutation.isPending}>
        {mutation.isPending ? t('settings_analytics.saving', { defaultValue: 'Saving…' }) : t('settings_analytics.save', { defaultValue: 'Save' })}
      </Button>
    </form>
  );
}
