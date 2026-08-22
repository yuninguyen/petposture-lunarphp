import type { Control, UseFormRegister } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { PostFormValues } from './postSchema';
import type { AffiliateNetwork } from './postsApi';
import { ComparisonItemRepeater } from './ComparisonItemRepeater';
import { Card } from '../../components/ui/card';
import { Textarea } from '../../components/ui/textarea';

interface ComparisonDetailsSectionProps {
  control: Control<PostFormValues>;
  register: UseFormRegister<PostFormValues>;
  affiliateNetworks: AffiliateNetwork[];
}

export function ComparisonDetailsSection({ control, register, affiliateNetworks }: ComparisonDetailsSectionProps) {
  const { t } = useTranslation();

  return (
    <Card className="space-y-4 p-5">
      <h3 className="text-lg font-semibold text-slate-800">{t('posts.comparison.section_title')}</h3>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">{t('posts.comparison.intro')}</label>
        <Textarea {...register('comparison_intro')} rows={3} />
      </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" {...register('disclosure_shown')} id="disclosure_shown" defaultChecked />
          <label htmlFor="disclosure_shown" className="text-sm font-medium text-slate-700">
            {t('posts.comparison.disclosure_shown')}
          </label>
        </div>

      <div>
        <h4 className="block text-sm font-medium text-slate-700 mb-3">{t('posts.comparison.items_title')}</h4>
        <ComparisonItemRepeater control={control} register={register} affiliateNetworks={affiliateNetworks} />
      </div>
    </Card>
  );
}
