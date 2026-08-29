import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Controller, useWatch, type Control, type UseFormGetValues, type UseFormRegister, type UseFormSetValue } from 'react-hook-form';
import type { PostFormValues } from './postSchema';
import { useGenerateSeo } from './postsApi';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Button } from '../../components/ui/button';
import { SparklesIcon } from '../../components/ui/icons';
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
  contentType?: 'blog' | 'product';
  googlePreviewImage?: string | null;
  googlePreviewPath?: string;
}

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

export function SeoSettingsSection({ control, register, setValue, getValues, titleKey = 'title', contentKey = 'content', mediaContext = 'blog', contentType = 'blog', googlePreviewImage = null, googlePreviewPath = '' }: SeoSettingsSectionProps) {
  const { t } = useTranslation();
  const generateSeo = useGenerateSeo();
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

  const tabClass = (active: boolean) =>
    clsx(
      'px-3 py-1.5 text-sm font-semibold rounded-t-lg border border-b-0 -mb-px',
      active ? 'bg-white text-primary border-gray-300' : 'bg-gray-100 text-gray-500 border-transparent hover:bg-gray-200'
    );

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center justify-between gap-4 mb-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">{t('posts.section_seo')}</h3>
          <p className="text-sm text-gray-500">{t('posts.seo.section_hint')}</p>
        </div>
        <Button type="button" variant="secondary" className="whitespace-nowrap shrink-0" disabled={generateSeo.isPending} onClick={handleGenerate}>
          <SparklesIcon className="h-4 w-4" />
          {generateSeo.isPending ? t('posts.seo.generating_ai') : t('posts.seo.generate_ai')}
        </Button>
      </div>

      <div className="space-y-4">

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
