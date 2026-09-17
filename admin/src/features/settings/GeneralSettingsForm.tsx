import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MediaPicker } from '@/features/media/MediaPicker';
import {
  fetchGeneralSettings,
  updateGeneralSettings,
  type GeneralSettingsState,
  type GeneralSettingsUpdatePayload,
  type MediaSettingValue,
} from './api';

const QUERY_KEY = ['admin', 'settings', 'general'] as const;

function sameMedia(left: MediaSettingValue | null, right: MediaSettingValue | null): boolean {
  return left?.id === right?.id && left?.url === right?.url;
}

function mediaPayload(value: MediaSettingValue | null): { media_id: string } | null {
  return value?.id ? { media_id: value.id } : null;
}

export function GeneralSettingsForm() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => (await fetchGeneralSettings()).data,
  });
  const [shopName, setShopName] = useState('');
  const [description, setDescription] = useState('');
  const [logo, setLogo] = useState<MediaSettingValue | null>(null);
  const [favicon, setFavicon] = useState<MediaSettingValue | null>(null);

  useEffect(() => {
    if (!query.data) return;
    setShopName(query.data.shop_name ?? '');
    setDescription(query.data.shop_description ?? '');
    setLogo(query.data.shop_logo);
    setFavicon(query.data.shop_favicon);
  }, [query.data]);

  const payload = useMemo<GeneralSettingsUpdatePayload>(() => {
    if (!query.data) return {};
    const next: GeneralSettingsUpdatePayload = {};
    if (shopName !== (query.data.shop_name ?? '')) next.shop_name = shopName;
    if (description !== (query.data.shop_description ?? '')) next.shop_description = description || null;
    if (!sameMedia(logo, query.data.shop_logo)) next.shop_logo = mediaPayload(logo);
    if (!sameMedia(favicon, query.data.shop_favicon)) next.shop_favicon = mediaPayload(favicon);
    return next;
  }, [description, favicon, logo, query.data, shopName]);

  const mutation = useMutation({
    mutationFn: (next: GeneralSettingsUpdatePayload) => updateGeneralSettings(next),
    onSuccess: ({ data }) => {
      queryClient.setQueryData<GeneralSettingsState>(QUERY_KEY, data);
    },
  });
  const hasChanges = Object.keys(payload).length > 0;

  if (query.isLoading) {
    return <p role="status" className="text-sm text-slate-500">{t('settings_general.loading', { defaultValue: 'Loading general settings…' })}</p>;
  }
  if (query.isError || !query.data) {
    return <p role="alert" className="text-sm text-red-600">{t('settings_general.load_error', { defaultValue: 'General settings could not be loaded.' })}</p>;
  }

  return (
    <form className="space-y-6" onSubmit={(event) => { event.preventDefault(); if (hasChanges) mutation.mutate(payload); }}>
      <div className="space-y-2">
        <label htmlFor="shop_name" className="text-sm font-medium text-ink">{t('settings_general.shop_name', { defaultValue: 'Shop name' })}</label>
        <Input id="shop_name" value={shopName} disabled={mutation.isPending} onChange={(event) => setShopName(event.target.value)} />
      </div>
      <div className="space-y-2">
        <label htmlFor="shop_description" className="text-sm font-medium text-ink">{t('settings_general.shop_description', { defaultValue: 'Shop description' })}</label>
        <Textarea id="shop_description" value={description} disabled={mutation.isPending} onChange={(event) => setDescription(event.target.value)} />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-sm font-medium text-ink">{t('settings_general.shop_logo', { defaultValue: 'Shop logo' })}</p>
          <MediaPicker value={logo} onChange={setLogo} context="general" />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-ink">{t('settings_general.shop_favicon', { defaultValue: 'Shop favicon' })}</p>
          <MediaPicker value={favicon} onChange={setFavicon} context="general" />
        </div>
      </div>
      {mutation.isError && <p role="alert" className="text-sm text-red-600">{t('settings_general.save_error', { defaultValue: 'General settings could not be saved.' })}</p>}
      <Button type="submit" disabled={!hasChanges || mutation.isPending}>
        {mutation.isPending ? t('settings_general.saving', { defaultValue: 'Saving…' }) : t('settings_general.save', { defaultValue: 'Save' })}
      </Button>
    </form>
  );
}
