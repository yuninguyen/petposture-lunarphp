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
  const [logo, setLogo] = useState<MediaSettingValue | null>(null);
  const [favicon, setFavicon] = useState<MediaSettingValue | null>(null);

  useEffect(() => {
    if (!query.data) return;
    setLogo(query.data.admin_logo);
    setFavicon(query.data.admin_favicon);
  }, [query.data]);

  const payload = useMemo<BrandingSettingsUpdatePayload>(() => {
    if (!query.data) return {};
    const next: BrandingSettingsUpdatePayload = {};
    if (!sameMedia(logo, query.data.admin_logo)) next.admin_logo = mediaPayload(logo);
    if (!sameMedia(favicon, query.data.admin_favicon)) next.admin_favicon = mediaPayload(favicon);
    return next;
  }, [favicon, logo, query.data]);

  const mutation = useMutation({
    mutationFn: (next: BrandingSettingsUpdatePayload) => updateBrandingSettings(next),
    onSuccess: ({ data }) => {
      queryClient.setQueryData<BrandingSettingsState>(QUERY_KEY, data);
    },
  });
  const hasChanges = Object.keys(payload).length > 0;

  if (query.isLoading) {
    return <p role="status" className="text-sm text-slate-500">{t('settings_branding.loading', { defaultValue: 'Loading branding settings…' })}</p>;
  }
  if (query.isError || !query.data) {
    return <p role="alert" className="text-sm text-red-600">{t('settings_branding.load_error', { defaultValue: 'Branding settings could not be loaded.' })}</p>;
  }

  return (
    <form className="space-y-6" onSubmit={(event) => { event.preventDefault(); if (hasChanges) mutation.mutate(payload); }}>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-sm font-medium text-ink">{t('settings_branding.admin_logo', { defaultValue: 'Admin logo' })}</p>
          <MediaPicker value={logo} onChange={setLogo} context="general" />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-ink">{t('settings_branding.admin_favicon', { defaultValue: 'Admin favicon' })}</p>
          <MediaPicker value={favicon} onChange={setFavicon} context="general" />
        </div>
      </div>
      {mutation.isError && <p role="alert" className="text-sm text-red-600">{t('settings_branding.save_error', { defaultValue: 'Branding settings could not be saved.' })}</p>}
      <Button type="submit" disabled={!hasChanges || mutation.isPending}>
        {mutation.isPending ? t('settings_branding.saving', { defaultValue: 'Saving…' }) : t('settings_branding.save', { defaultValue: 'Save' })}
      </Button>
    </form>
  );
}
