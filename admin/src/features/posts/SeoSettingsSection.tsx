import { useTranslation } from 'react-i18next';
import { Controller, type Control, type UseFormGetValues, type UseFormRegister, type UseFormSetValue } from 'react-hook-form';
import type { PostFormValues } from './postSchema';
import { useGenerateSeo } from './postsApi';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Button } from '../../components/ui/button';
import { MediaPicker } from '../media/MediaPicker';

interface SeoSettingsSectionProps {
  control: Control<PostFormValues>;
  register: UseFormRegister<PostFormValues>;
  setValue: UseFormSetValue<PostFormValues>;
  getValues: UseFormGetValues<PostFormValues>;
}

export function SeoSettingsSection({ control, register, setValue, getValues }: SeoSettingsSectionProps) {
  const { t } = useTranslation();
  const generateSeo = useGenerateSeo();

  function handleGenerate() {
    const { title, content } = getValues();
    generateSeo.mutate(
      { title: title ?? '', content: content ?? '' },
      {
        onSuccess: (data) => {
          setValue('seo.title', data.seo_title, { shouldValidate: true });
          setValue('seo.keyphrase', data.focus_keyphrase, { shouldValidate: true });
          setValue('seo.description', data.meta_description, { shouldValidate: true });
          setValue('seo.og_title', data.social_title, { shouldValidate: true });
          setValue('seo.og_description', data.social_description, { shouldValidate: true });
        },
      }
    );
  }

  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t('posts.section_seo')}</h3>
        <Button type="button" variant="secondary" disabled={generateSeo.isPending} onClick={handleGenerate}>
          {generateSeo.isPending ? t('posts.seo.generating_ai') : t('posts.seo.generate_ai')}
        </Button>
      </div>

      {generateSeo.isError && (
        <p className="text-xs text-red-600">{(generateSeo.error as Error).message}</p>
      )}

      <div className="space-y-3">
        <h4 className="text-sm font-semibold">{t('posts.seo.subsection_google')}</h4>
        <div>
          <label className="text-sm font-medium">{t('posts.seo.title')}</label>
          <Input {...register('seo.title')} maxLength={60} />
        </div>
        <div>
          <label className="text-sm font-medium">{t('posts.seo.keyphrase')}</label>
          <Input {...register('seo.keyphrase')} />
        </div>
        <div>
          <label className="text-sm font-medium">{t('posts.seo.description')}</label>
          <Textarea {...register('seo.description')} rows={2} maxLength={160} />
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold">{t('posts.seo.subsection_social')}</h4>
        <div>
          <label className="text-sm font-medium">{t('posts.seo.og_title')}</label>
          <Input {...register('seo.og_title')} />
        </div>
        <div>
          <label className="text-sm font-medium">{t('posts.seo.og_description')}</label>
          <Textarea {...register('seo.og_description')} rows={2} />
        </div>
        <div>
          <label className="text-sm font-medium">{t('posts.seo.og_image')}</label>
          <Controller
            control={control}
            name="seo.og_image"
            render={({ field }) => (
              <MediaPicker
                value={field.value ? { id: '', url: field.value } : null}
                onChange={(media) => field.onChange(media?.url ?? null)}
              />
            )}
          />
        </div>
      </div>
    </Card>
  );
}
