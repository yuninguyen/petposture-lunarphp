import { Controller, useFieldArray, useWatch, type Control, type UseFormRegister } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import type { PostFormValues } from './postSchema';
import type { AffiliateNetwork } from './postsApi';
import { MediaPicker } from '../media/MediaPicker';
import { TagInput } from '../../components/ui/tag-input';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';

interface ComparisonItemRepeaterProps {
  control: Control<PostFormValues>;
  register: UseFormRegister<PostFormValues>;
  affiliateNetworks: AffiliateNetwork[];
}

function formatPriceDisplay(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('$') ? trimmed : `$${trimmed}`;
}

function HighlightBadgeInput({ control, index }: { control: Control<PostFormValues>; index: number }) {
  const { t } = useTranslation();

  return (
    <Controller
      control={control}
      name={`comparison_items.${index}.highlight`}
      render={({ field }) => (
        <TagInput
          value={field.value ? [field.value] : []}
          onChange={(tags) => field.onChange(tags.length ? tags[tags.length - 1] : undefined)}
          placeholder={t('posts.comparison.add_highlight')}
        />
      )}
    />
  );
}

function RowSummary({
  control,
  index,
  affiliateNetworks,
}: {
  control: Control<PostFormValues>;
  index: number;
  affiliateNetworks: AffiliateNetwork[];
}) {
  const { t } = useTranslation();
  const productName = useWatch({ control, name: `comparison_items.${index}.product_name` });
  const priceDisplay = useWatch({ control, name: `comparison_items.${index}.price_display` });
  const retailer = useWatch({ control, name: `comparison_items.${index}.retailer` });

  const network = affiliateNetworks.find((n) => n.slug === retailer);
  const retailerLabel = network?.name ?? (retailer ? retailer.charAt(0).toUpperCase() + retailer.slice(1) : '');
  const price = formatPriceDisplay(priceDisplay);

  return (
    <span className="text-sm text-gray-400">
      {productName || t('posts.comparison.untitled_item')}
      {retailerLabel ? ` — ${retailerLabel}` : ''}
      {price ? ` — ${price}` : ''}
    </span>
  );
}

export function ComparisonItemRepeater({ control, register, affiliateNetworks }: ComparisonItemRepeaterProps) {
  const { t } = useTranslation();
  const { fields, append, remove } = useFieldArray({ control, name: 'comparison_items' });
  const [expandedIndex, setExpandedIndex] = useState<number | null>(fields.length === 0 ? null : 0);

  return (
    <div className="space-y-3">
      {fields.map((field, index) => {
        const isExpanded = expandedIndex === index;
        return (
          <div key={field.id} className="rounded-lg border border-gray-300">
            <div className="flex items-center justify-between gap-2 px-3 py-2">
              <button
                type="button"
                onClick={() => setExpandedIndex(isExpanded ? null : index)}
                className="flex flex-1 items-center gap-2 text-left"
              >
                <span className="font-medium">{t('posts.comparison.item_label', { defaultValue: 'Item' })} {index + 1}</span>
                <RowSummary control={control} index={index} affiliateNetworks={affiliateNetworks} />
              </button>
              <Button type="button" variant="danger" onClick={() => remove(index)}>
                {t('posts.comparison.remove_item')}
              </Button>
            </div>

            {isExpanded && (
              <div className="space-y-3 border-t border-gray-300 p-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('posts.comparison.product_name')}</label>
                    <Input {...register(`comparison_items.${index}.product_name`)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('posts.comparison.retailer')}</label>
                    <div className="relative">
                      <select
                        {...register(`comparison_items.${index}.retailer`)}
                        className="appearance-none w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-8 text-sm text-slate-700 hover:bg-slate-50 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors cursor-pointer shadow-sm"
                      >
                        <option value="">{t('posts.comparison.select_retailer')}</option>
                        {affiliateNetworks.map((network) => (
                          <option key={network.slug} value={network.slug}>
                            {network.name}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Media & Metrics Split (Bento Grid Style) */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                  {/* Left Col: Image (5/12) */}
                  <div className="flex flex-col md:col-span-5">
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('posts.comparison.image')}</label>
                    <div className="flex-1 flex flex-col min-h-[142px]">
                      <Controller
                        control={control}
                        name={`comparison_items.${index}.image_url`}
                        render={({ field: imageField }) => (
                          <MediaPicker
                            context="blog"
                            fill
                            value={imageField.value ? { id: '', url: imageField.value } : null}
                            onChange={(media) => imageField.onChange(media?.url ?? null)}
                          />
                        )}
                      />
                    </div>
                  </div>

                  {/* Right Col: Metrics (7/12) */}
                  <div className="space-y-4 flex flex-col md:col-span-7">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('posts.comparison.highlight_label')}</label>
                        <HighlightBadgeInput control={control} index={index} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('posts.comparison.rating')}</label>
                        <Input type="number" step="0.1" min="0" max="5" {...register(`comparison_items.${index}.rating`)} className="shadow-sm" />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('posts.comparison.price_display')}</label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="64.99"
                          {...register(`comparison_items.${index}.price_display`)}
                          className="shadow-sm"
                        />
                        <p className="mt-1 text-xs text-gray-400">{t('posts.comparison.price_hint')}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('posts.comparison.price_cents')}</label>
                        <Input type="number" {...register(`comparison_items.${index}.price_cents`)} className="shadow-sm" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('posts.comparison.image_alt')}</label>
                      <Input {...register(`comparison_items.${index}.image_alt`)} className="shadow-sm" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('posts.comparison.affiliate_url')}</label>
                    <Input {...register(`comparison_items.${index}.affiliate_url`)} placeholder="https://..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      {t('posts.comparison.in_house_match_url')}{' '}
                      <span className="font-normal text-slate-400">({t('posts.comparison.optional_suffix')})</span>
                    </label>
                    <Input {...register(`comparison_items.${index}.in_house_match_url`)} placeholder="https://..." />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input type="checkbox" {...register(`comparison_items.${index}.in_stock`)} id={`in_stock_${index}`} />
                  <label htmlFor={`in_stock_${index}`} className="text-sm font-medium text-ink">
                    {t('posts.comparison.in_stock')}
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('posts.comparison.pros')}</label>
                    <Controller
                      control={control}
                      name={`comparison_items.${index}.pros`}
                      render={({ field: prosField }) => (
                        <TagInput value={prosField.value ?? []} onChange={prosField.onChange} placeholder={t('posts.comparison.add_pro')} />
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('posts.comparison.cons')}</label>
                    <Controller
                      control={control}
                      name={`comparison_items.${index}.cons`}
                      render={({ field: consField }) => (
                        <TagInput value={consField.value ?? []} onChange={consField.onChange} placeholder={t('posts.comparison.add_con')} />
                      )}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <Button
        type="button"
        variant="primary"
        onClick={() => {
          append({
            product_name: '',
            image_url: null,
            image_alt: '',
            retailer: '',
            highlight: undefined,
            in_stock: true,
            price_display: '',
            price_cents: undefined,
            rating: undefined,
            affiliate_url: '',
            pros: [],
            cons: [],
            in_house_match_url: '',
          });
          setExpandedIndex(fields.length);
        }}
      >
        {t('posts.comparison.add_item')}
      </Button>
    </div>
  );
}
