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

function RowSummary({ control, index }: { control: Control<PostFormValues>; index: number }) {
  const { t } = useTranslation();
  const productName = useWatch({ control, name: `comparison_items.${index}.product_name` });
  const priceDisplay = useWatch({ control, name: `comparison_items.${index}.price_display` });
  const retailer = useWatch({ control, name: `comparison_items.${index}.retailer` });

  return (
    <span className="text-sm text-gray-400">
      {productName || t('posts.comparison.untitled_item')}
      {retailer ? ` — ${retailer}` : ''}
      {priceDisplay ? ` — ${priceDisplay}` : ''}
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
                <RowSummary control={control} index={index} />
              </button>
              <Button type="button" variant="secondary" onClick={() => remove(index)}>
                {t('posts.comparison.remove_item')}
              </Button>
            </div>

            {isExpanded && (
              <div className="space-y-3 border-t border-gray-300 p-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">{t('posts.comparison.product_name')}</label>
                    <Input {...register(`comparison_items.${index}.product_name`)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t('posts.comparison.retailer')}</label>
                    <select
                      {...register(`comparison_items.${index}.retailer`)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-ink"
                    >
                      <option value="">{t('posts.comparison.select_retailer')}</option>
                      {affiliateNetworks.map((network) => (
                        <option key={network.slug} value={network.slug}>
                          {network.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">{t('posts.comparison.image')}</label>
                  <Controller
                    control={control}
                    name={`comparison_items.${index}.image_url`}
                    render={({ field: imageField }) => (
                      <MediaPicker
                        value={imageField.value ? { id: '', url: imageField.value } : null}
                        onChange={(media) => imageField.onChange(media?.url ?? null)}
                      />
                    )}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-sm font-medium">{t('posts.comparison.highlight')}</label>
                    <select
                      {...register(`comparison_items.${index}.highlight`)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-ink"
                    >
                      <option value="">{t('posts.comparison.highlight.none')}</option>
                      <option value="best_overall">{t('posts.comparison.highlight.best_overall')}</option>
                      <option value="best_value">{t('posts.comparison.highlight.best_value')}</option>
                      <option value="budget_pick">{t('posts.comparison.highlight.budget_pick')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t('posts.comparison.price_display')}</label>
                    <Input {...register(`comparison_items.${index}.price_display`)} placeholder="$64.99" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t('posts.comparison.price_cents')}</label>
                    <Input type="number" {...register(`comparison_items.${index}.price_cents`)} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-sm font-medium">{t('posts.comparison.rating')}</label>
                    <Input type="number" step="0.1" min="0" max="5" {...register(`comparison_items.${index}.rating`)} />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <input type="checkbox" {...register(`comparison_items.${index}.in_stock`)} id={`in_stock_${index}`} />
                    <label htmlFor={`in_stock_${index}`} className="text-sm font-medium">
                      {t('posts.comparison.in_stock')}
                    </label>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">{t('posts.comparison.affiliate_url')}</label>
                  <Input {...register(`comparison_items.${index}.affiliate_url`)} placeholder="https://..." />
                </div>

                <div>
                  <label className="text-sm font-medium">{t('posts.comparison.in_house_match_url')}</label>
                  <Input {...register(`comparison_items.${index}.in_house_match_url`)} placeholder="https://..." />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">{t('posts.comparison.pros')}</label>
                    <Controller
                      control={control}
                      name={`comparison_items.${index}.pros`}
                      render={({ field: prosField }) => (
                        <TagInput value={prosField.value ?? []} onChange={prosField.onChange} placeholder={t('posts.comparison.add_pro')} />
                      )}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t('posts.comparison.cons')}</label>
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
