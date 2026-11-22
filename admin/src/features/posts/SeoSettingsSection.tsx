import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Controller, useWatch, type Control, type UseFormGetValues, type UseFormRegister, type UseFormSetValue } from 'react-hook-form';
import type { PostFormValues } from './postSchema';
import { useGenerateSeo } from './postsApi';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Button } from '../../components/ui/button';
import { CopyIcon, SparklesIcon } from '../../components/ui/icons';
import toast from 'react-hot-toast';
import { buildSeoPrompt, parseSeoJson, plainText, type SeoContentType, type SeoJsonKey } from './seoPrompt';
import { MediaPicker } from '../media/MediaPicker';
import type { MediaContext } from '../../components/ui/media-library-modal';
import clsx from 'clsx';

interface SeoSettingsSectionProps {
  control: Control<any>;
  register: UseFormRegister<any>;
  setValue: UseFormSetValue<any>;
  getValues: UseFormGetValues<any>;
  titleKey?: string;
  contentKey?: string;
  mediaContext?: MediaContext;
  contentType?: SeoContentType;
  googlePreviewImage?: string | null;
  googlePreviewPath?: string;
  /** More fields the "Copy prompt" text should include besides the title and content, e.g. a Pick's "Our take". */
  extraContent?: { label: string; key: string }[];
}

// What a chatbot answer's keys are called in this form, for the "too long" message.
const JSON_KEY_LABEL: Record<SeoJsonKey, string> = {
  seo_title: 'posts.seo.title',
  focus_keyphrase: 'posts.seo.keyphrase',
  meta_description: 'posts.seo.description',
  social_title: 'posts.seo.og_title',
  social_description: 'posts.seo.og_description',
};

type SeoTab = 'google' | 'social';

function CharCounter({ count, max }: { count: number; max: number }) {
  const { t } = useTranslation();
  const remaining = max - count;
  return (
    <p className={clsx('mt-1 text-xs', remaining < 0 ? 'text-red-500' : 'text-gray-400')}>
      {t('posts.seo.chars_left', { count: remaining })}
    </p>
  );
}

export function SeoSettingsSection({ control, register, setValue, getValues, titleKey = 'title', contentKey = 'content', mediaContext = 'blog', contentType = 'blog', googlePreviewImage = null, googlePreviewPath = '', extraContent = [] }: SeoSettingsSectionProps) {
  const { t } = useTranslation();
  const generateSeo = useGenerateSeo();
  const [pasted, setPasted] = useState('');
  const [pasteMessage, setPasteMessage] = useState<{ tone: 'error' | 'warn' | 'ok'; text: string } | null>(null);
  const [tab, setTab] = useState<SeoTab>('google');
  const [generated, setGenerated] = useState(false);
  const [needTitle, setNeedTitle] = useState(false);

  const seoTitle = useWatch({ control, name: 'seo.title' }) ?? '';
  const seoKeyphrase = useWatch({ control, name: 'seo.keyphrase' }) ?? '';
  const seoDescription = useWatch({ control, name: 'seo.description' }) ?? '';
  const ogTitle = useWatch({ control, name: 'seo.og_title' }) ?? '';
  const ogDescription = useWatch({ control, name: 'seo.og_description' }) ?? '';
  const ogImage = useWatch({ control, name: 'seo.og_image' }) ?? '';
  const contentTitle = useWatch({ control, name: titleKey }) ?? '';

  function handleGenerate() {
    const title = getValues(titleKey);
    const content = getValues(contentKey);
    if (!title?.trim()) {
      setNeedTitle(true);
      return;
    }
    setNeedTitle(false);
    setGenerated(false);
    generateSeo.mutate(
      { title, content: content ?? '', content_type: contentType },
      {
        onSuccess: (data) => {
          setValue('seo.title', data.seo_title, { shouldValidate: true });
          setValue('seo.keyphrase', data.focus_keyphrase, { shouldValidate: true });
          setValue('seo.description', data.meta_description, { shouldValidate: true });
          setValue('seo.og_title', data.social_title, { shouldValidate: true });
          setValue('seo.og_description', data.social_description, { shouldValidate: true });
          setGenerated(true);
        },
      }
    );
  }

  // The way without the paid API: the prompt goes to whatever chatbot Yuni already uses, and its JSON answer comes back here.
  async function handleCopyPrompt() {
    const title = plainText(getValues(titleKey));
    if (!title) {
      setNeedTitle(true);
      return;
    }
    setNeedTitle(false);
    const prompt = buildSeoPrompt({
      contentType,
      title,
      content: getValues(contentKey),
      extras: extraContent.map((extra) => ({ label: extra.label, value: getValues(extra.key) })),
    });
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success(t('posts.seo.copy_prompt_done'));
    } catch {
      toast.error(t('posts.seo.copy_prompt_failed'));
    }
  }

  function handleFillFromJson() {
    const result = parseSeoJson(pasted);
    if (!result.ok) {
      setPasteMessage({
        tone: 'error',
        text: result.error === 'empty' ? t('posts.seo.paste_empty') : result.error === 'invalid' ? t('posts.seo.paste_invalid') : t('posts.seo.paste_missing_keys', { keys: result.missing.join(', ') }),
      });
      return;
    }
    const options = { shouldValidate: true, shouldDirty: true };
    setValue('seo.title', result.data.seo_title, options);
    setValue('seo.keyphrase', result.data.focus_keyphrase, options);
    setValue('seo.description', result.data.meta_description, options);
    setValue('seo.og_title', result.data.social_title, options);
    setValue('seo.og_description', result.data.social_description, options);
    setPasted('');
    setPasteMessage(result.tooLong.length > 0
      ? { tone: 'warn', text: t('posts.seo.paste_too_long', { fields: result.tooLong.map((key) => t(JSON_KEY_LABEL[key])).join(', ') }) }
      : { tone: 'ok', text: t('posts.seo.paste_filled') });
  }

  const tabClass = (active: boolean) =>
    clsx(
      'px-3 py-1.5 text-sm font-semibold rounded-t-lg border border-b-0 -mb-px',
      active ? 'bg-white text-primary border-gray-300' : 'bg-gray-100 text-gray-500 border-transparent hover:bg-gray-200'
    );

  return (
    <Card className="space-y-4 p-5">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">{t('posts.section_seo')}</h3>
          <p className="text-sm text-gray-500">{t('posts.seo.section_hint')}</p>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" className="whitespace-nowrap shrink-0" onClick={handleCopyPrompt}>
              <CopyIcon className="h-4 w-4" />
              {t('posts.seo.copy_prompt')}
            </Button>
            <Button type="button" variant="secondary" className="whitespace-nowrap shrink-0" disabled={generateSeo.isPending} onClick={handleGenerate}>
              <SparklesIcon className="h-4 w-4" />
              {generateSeo.isPending ? t('posts.seo.generating_ai') : t('posts.seo.generate_ai')}
            </Button>
          </div>
          <p className="text-xs text-gray-500" data-testid="ai-api-fallback-note">{t('posts.seo.api_fallback_note')}</p>
        </div>
      </div>

      <div className="space-y-4">

        <div className="space-y-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3" data-testid="seo-chatbot-panel">
          <p className="text-xs text-gray-600">{t('posts.seo.chatbot_hint')}</p>
          <label className="block text-sm font-medium text-slate-700">{t('posts.seo.paste_label')}</label>
          <Textarea value={pasted} onChange={(event) => setPasted(event.target.value)} rows={3} placeholder={t('posts.seo.paste_placeholder')} data-testid="seo-json-input" />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="secondary" onClick={handleFillFromJson}>{t('posts.seo.fill_from_json')}</Button>
            {pasteMessage && (
              <p role="status" className={clsx('text-xs', pasteMessage.tone === 'error' ? 'text-red-600' : pasteMessage.tone === 'warn' ? 'text-amber-700' : 'text-green-600')} data-testid="seo-json-message">
                {pasteMessage.text}
              </p>
            )}
          </div>
        </div>

        {needTitle && <p className="text-xs text-red-600">{t('posts.seo.add_title_first')}</p>}
        {generateSeo.isError && <p className="text-xs text-red-600">{(generateSeo.error as Error).message}</p>}
        {generated && !generateSeo.isError && (
          <p className="text-xs text-green-600">{t('posts.seo.generated_hint')}</p>
        )}

        <div>
          <div className="flex gap-1 border-b border-gray-300">
            <button type="button" onClick={() => setTab('google')} className={tabClass(tab === 'google')}>
              {t('posts.seo.subsection_google')}
            </button>
            <button type="button" onClick={() => setTab('social')} className={tabClass(tab === 'social')}>
              {t('posts.seo.subsection_social')}
            </button>
          </div>

          <div className="space-y-3 border border-t-0 border-gray-300 rounded-b-lg p-3">
            {tab === 'google' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('posts.seo.title')}</label>
                  <Input {...register('seo.title')} maxLength={60} />
                  <CharCounter count={seoTitle.length} max={60} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('posts.seo.keyphrase')}</label>
                  <Input {...register('seo.keyphrase')} maxLength={50} />
                  <CharCounter count={seoKeyphrase.length} max={50} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('posts.seo.description')}</label>
                  <Textarea {...register('seo.description')} rows={3} maxLength={160} />
                  <CharCounter count={seoDescription.length} max={160} />
                </div>

                <div className="rounded-lg border border-gray-300 bg-white p-4" data-testid="google-search-preview">
                  <p className="mb-3 text-xs font-semibold captitalize tracking-wide text-gray-500">
                    {t('posts.seo.google_preview')}
                  </p>
                  <div className="flex items-start gap-5">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-white">
                          <img src="/favicon.png" alt="" className="h-6 w-6 object-contain" />
                        </div>
                        <div className="min-w-0 leading-tight">
                          <p className="truncate text-sm font-medium text-slate-700" data-testid="google-preview-site-name">PetPosture</p>
                          <p className="truncate text-xs text-gray-600" data-testid="google-preview-url">
                            https://petposture.com{googlePreviewPath && ` › ${googlePreviewPath.split('/').filter(Boolean).join(' › ')}`}
                          </p>
                        </div>
                      </div>
                      <p className="line-clamp-2 text-xl leading-snug text-blue-700" data-testid="google-preview-title">
                        {seoTitle.trim() || contentTitle.trim() || t('posts.seo.google_preview_untitled')}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-gray-700" data-testid="google-preview-description">
                        {seoDescription.trim() || t('posts.seo.google_preview_no_description')}
                      </p>
                    </div>
                    {googlePreviewImage && (
                      <img
                        src={googlePreviewImage}
                        alt=""
                        className="mt-1 h-24 w-24 shrink-0 rounded-lg object-cover sm:h-28 sm:w-28"
                        data-testid="google-preview-image"
                      />
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('posts.seo.og_title')}</label>
                  <Input {...register('seo.og_title')} maxLength={60} />
                  <CharCounter count={ogTitle.length} max={60} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('posts.seo.og_description')}</label>
                  <Textarea {...register('seo.og_description')} rows={3} maxLength={200} />
                  <CharCounter count={ogDescription.length} max={200} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('posts.seo.og_image')}</label>
                  <Controller
                    control={control}
                    name="seo.og_image"
                    render={({ field }) => (
                      <MediaPicker
                        context={mediaContext}
                        value={field.value ? { id: '', url: field.value } : null}
                        onChange={(media) => field.onChange(media?.url ?? null)}
                      />
                    )}
                  />
                </div>

                <div className="overflow-hidden rounded-lg border border-gray-300 bg-white" data-testid="social-preview">
                  <p className="border-b border-gray-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {t('posts.seo.social_preview')}
                  </p>
                  {ogImage ? (
                    <img
                      src={ogImage}
                      alt=""
                      className="aspect-[1.91/1] w-full object-cover"
                      data-testid="social-preview-image"
                    />
                  ) : (
                    <div className="flex aspect-[1.91/1] w-full items-center justify-center bg-gray-100 text-sm text-gray-400">
                      {t('posts.seo.social_preview_no_image')}
                    </div>
                  )}
                  <div className="space-y-1 border-t border-gray-200 bg-gray-50 px-3 py-2.5">
                    <p className="text-xs uppercase text-gray-500">petposture.com</p>
                    <p className="line-clamp-2 font-semibold text-slate-800">
                      {ogTitle.trim() || contentTitle.trim() || t('posts.seo.social_preview_untitled')}
                    </p>
                    {ogDescription.trim() && (
                      <p className="line-clamp-2 text-sm text-gray-600">{ogDescription}</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
