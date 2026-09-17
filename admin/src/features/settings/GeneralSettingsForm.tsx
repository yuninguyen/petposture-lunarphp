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
  const [baseline, setBaseline] = useState<GeneralSettingsState | null>(null);
  const [shopName, setShopName] = useState('');
  const [description, setDescription] = useState('');
  const [logo, setLogo] = useState<MediaSettingValue | null>(null);
  const [favicon, setFavicon] = useState<MediaSettingValue | null>(null);
  const [nameError, setNameError] = useState(false);
  const [saved, setSaved] = useState(false);

  const adoptServerState = (data: GeneralSettingsState) => {
    setBaseline(data);
    setShopName(data.shop_name ?? '');
    setDescription(data.shop_description ?? '');
    setLogo(data.shop_logo);
    setFavicon(data.shop_favicon);
  };

  useEffect(() => {
    if (query.data && !baseline) adoptServerState(query.data);
  }, [baseline, query.data]);

  const normalizedShopName = shopName.trim();
  const payload = useMemo<GeneralSettingsUpdatePayload>(() => {
    if (!baseline) return {};
    const next: GeneralSettingsUpdatePayload = {};
    if (normalizedShopName && normalizedShopName !== (baseline.shop_name ?? '')) next.shop_name = normalizedShopName;
    if (description !== (baseline.shop_description ?? '')) next.shop_description = description || null;
    if (!sameMedia(logo, baseline.shop_logo)) next.shop_logo = mediaPayload(logo);
    if (!sameMedia(favicon, baseline.shop_favicon)) next.shop_favicon = mediaPayload(favicon);
    return next;
  }, [baseline, description, favicon, logo, normalizedShopName]);

  const mutation = useMutation({
    mutationFn: (next: GeneralSettingsUpdatePayload) => updateGeneralSettings(next),
    onSuccess: ({ data }) => {
      queryClient.setQueryData<GeneralSettingsState>(QUERY_KEY, data);
      adoptServerState(data);
      setSaved(true);
    },
  });
  const hasRawChanges = Boolean(baseline) && (
    shopName !== (baseline?.shop_name ?? '')
    || description !== (baseline?.shop_description ?? '')
    || !sameMedia(logo, baseline?.shop_logo ?? null)
    || !sameMedia(favicon, baseline?.shop_favicon ?? null)
  );
  const clearFeedback = () => {
    setSaved(false);
    setNameError(false);
    mutation.reset();
  };

  if (query.isLoading || (query.data && !baseline)) {
    return <p role="status" className="text-sm text-slate-500">{t('settings_general.loading', { defaultValue: 'Loading general settings…' })}</p>;
  }
  if (query.isError || !query.data || !baseline) {
    return <p role="alert" className="text-sm text-red-600">{t('settings_general.load_error', { defaultValue: 'General settings could not be loaded.' })}</p>;
  }

  return (
    <form className="space-y-6" onSubmit={(event) => {
      event.preventDefault();
      setSaved(false);
      mutation.reset();
      if (!normalizedShopName) {
        setNameError(true);
        return;
      }
      setNameError(false);
      if (Object.keys(payload).length > 0) mutation.mutate(payload);
    }}>
      <div className="space-y-2">
        <label htmlFor="shop_name" className="text-sm font-medium text-ink">{t('settings_general.shop_name', { defaultValue: 'Shop name' })}</label>
        <Input
          id="shop_name"
          value={shopName}
          disabled={mutation.isPending}
          aria-invalid={nameError || undefined}
          aria-describedby={nameError ? 'shop-name-error' : undefined}
          onChange={(event) => { clearFeedback(); setShopName(event.target.value); }}
        />
        {nameError && <p id="shop-name-error" role="alert" className="text-sm text-red-600">{t('settings_general.shop_name_required', { defaultValue: 'Shop name is required.' })}</p>}
      </div>
      <div className="space-y-2">
        <label htmlFor="shop_description" className="text-sm font-medium text-ink">{t('settings_general.shop_description', { defaultValue: 'Shop description' })}</label>
        <Textarea id="shop_description" value={description} disabled={mutation.isPending} onChange={(event) => { clearFeedback(); setDescription(event.target.value); }} />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <fieldset className="space-y-2" aria-labelledby="shop-logo-label">
          <legend id="shop-logo-label" className="text-sm font-medium text-ink">{t('settings_general.shop_logo', { defaultValue: 'Shop logo' })}</legend>
          <MediaPicker value={logo} disabled={mutation.isPending} onChange={(value) => { clearFeedback(); setLogo(value); }} context="general" />
        </fieldset>
        <fieldset className="space-y-2" aria-labelledby="shop-favicon-label">
          <legend id="shop-favicon-label" className="text-sm font-medium text-ink">{t('settings_general.shop_favicon', { defaultValue: 'Shop favicon' })}</legend>
          <MediaPicker value={favicon} disabled={mutation.isPending} onChange={(value) => { clearFeedback(); setFavicon(value); }} context="general" />
        </fieldset>
      </div>
      {mutation.isError && <p role="alert" className="text-sm text-red-600">{t('settings_general.save_error', { defaultValue: 'General settings could not be saved.' })}</p>}
      {saved && <p role="status" className="text-sm text-green-700">{t('settings_general.save_success', { defaultValue: 'General settings saved.' })}</p>}
      <Button type="submit" disabled={!hasRawChanges || mutation.isPending}>
        {mutation.isPending ? t('settings_general.saving', { defaultValue: 'Saving…' }) : t('settings_general.save', { defaultValue: 'Save' })}
      </Button>
    </form>
  );
}
