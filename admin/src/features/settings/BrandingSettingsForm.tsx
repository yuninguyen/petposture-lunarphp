import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { MediaPicker } from '@/features/media/MediaPicker';
import {
  fetchBrandingSettings,
  updateBrandingSettings,
  type BrandingSettingsState,
  type BrandingSettingsUpdatePayload,
  type MediaSettingValue,
} from './api';

const QUERY_KEY = ['admin', 'settings', 'branding'] as const;

function sameMedia(left: MediaSettingValue | null, right: MediaSettingValue | null): boolean {
  return left?.id === right?.id && left?.url === right?.url;
}

function mediaPayload(value: MediaSettingValue | null): { media_id: string } | null {
  return value?.id ? { media_id: value.id } : null;
}

export function BrandingSettingsForm() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => (await fetchBrandingSettings()).data,
  });
  const [baseline, setBaseline] = useState<BrandingSettingsState | null>(null);
  const [logo, setLogo] = useState<MediaSettingValue | null>(null);
  const [favicon, setFavicon] = useState<MediaSettingValue | null>(null);
  const [saved, setSaved] = useState(false);

  const adoptServerState = (data: BrandingSettingsState) => {
    setBaseline(data);
    setLogo(data.admin_logo);
    setFavicon(data.admin_favicon);
  };

  useEffect(() => {
    if (query.data && !baseline) adoptServerState(query.data);
  }, [baseline, query.data]);

  const payload = useMemo<BrandingSettingsUpdatePayload>(() => {
    if (!baseline) return {};
    const next: BrandingSettingsUpdatePayload = {};
    if (!sameMedia(logo, baseline.admin_logo)) next.admin_logo = mediaPayload(logo);
    if (!sameMedia(favicon, baseline.admin_favicon)) next.admin_favicon = mediaPayload(favicon);
    return next;
  }, [baseline, favicon, logo]);

  const mutation = useMutation({
    mutationFn: (next: BrandingSettingsUpdatePayload) => updateBrandingSettings(next),
    onSuccess: ({ data }) => {
      queryClient.setQueryData<BrandingSettingsState>(QUERY_KEY, data);
      adoptServerState(data);
      setSaved(true);
    },
  });
  const hasChanges = Object.keys(payload).length > 0;
  const changeMedia = (setter: (value: MediaSettingValue | null) => void, value: MediaSettingValue | null) => {
    setSaved(false);
    mutation.reset();
    setter(value);
  };

  if (query.isLoading || (query.data && !baseline)) {
    return <p role="status" className="text-sm text-slate-500">{t('settings_branding.loading', { defaultValue: 'Loading branding settings…' })}</p>;
  }
  if (query.isError || !query.data || !baseline) {
    return <p role="alert" className="text-sm text-red-600">{t('settings_branding.load_error', { defaultValue: 'Branding settings could not be loaded.' })}</p>;
  }

  return (
    <form className="space-y-6" onSubmit={(event) => { event.preventDefault(); setSaved(false); mutation.reset(); if (hasChanges) mutation.mutate(payload); }}>
      <div className="grid gap-6 md:grid-cols-2">
        <fieldset className="space-y-2" aria-labelledby="admin-logo-label">
          <legend id="admin-logo-label" className="text-sm font-medium text-ink">{t('settings_branding.admin_logo', { defaultValue: 'Admin logo' })}</legend>
          <MediaPicker value={logo} disabled={mutation.isPending} onChange={(value) => changeMedia(setLogo, value)} context="general" />
        </fieldset>
        <fieldset className="space-y-2" aria-labelledby="admin-favicon-label">
          <legend id="admin-favicon-label" className="text-sm font-medium text-ink">{t('settings_branding.admin_favicon', { defaultValue: 'Admin favicon' })}</legend>
          <MediaPicker value={favicon} disabled={mutation.isPending} onChange={(value) => changeMedia(setFavicon, value)} context="general" />
        </fieldset>
      </div>
      {mutation.isError && <p role="alert" className="text-sm text-red-600">{t('settings_branding.save_error', { defaultValue: 'Branding settings could not be saved.' })}</p>}
      {saved && <p role="status" className="text-sm text-green-700">{t('settings_branding.save_success', { defaultValue: 'Branding settings saved.' })}</p>}
      <Button type="submit" disabled={!hasChanges || mutation.isPending}>
        {mutation.isPending ? t('settings_branding.saving', { defaultValue: 'Saving…' }) : t('settings_branding.save', { defaultValue: 'Save' })}
      </Button>
    </form>
  );
}
