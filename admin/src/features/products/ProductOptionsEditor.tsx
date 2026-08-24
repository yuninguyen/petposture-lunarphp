import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { ProductOption, ProductVariant, SaveProductOptionsPayload } from './api';

type DraftValue = { id?: number; name: string };
type DraftOption = { id?: number; name: string; shared: boolean; values: DraftValue[] };

interface ProductOptionsEditorProps {
  options: ProductOption[];
  variants: ProductVariant[];
  isSavingOptions: boolean;
  isGenerating: boolean;
  isDeleting: boolean;
  onSaveOptions: (payload: SaveProductOptionsPayload) => Promise<void>;
  onGenerate: () => Promise<void>;
  onEditVariant: (variant: ProductVariant) => void;
  onDeleteVariant: (variant: ProductVariant) => Promise<void>;
}

export function ProductOptionsEditor({
  options,
  variants,
  isSavingOptions,
  isGenerating,
  isDeleting,
  onSaveOptions,
  onGenerate,
  onEditVariant,
  onDeleteVariant,
}: ProductOptionsEditorProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<DraftOption[]>(() => toDraft(options));

  useEffect(() => setDraft(toDraft(options)), [options]);

  const projectedCount = useMemo(
    () => draft.length === 0 ? 1 : draft.reduce((total, option) => total * option.values.length, 1),
    [draft],
  );
  const isValid = draft.every((option) => option.name.trim() && option.values.length > 0 && option.values.every((value) => value.name.trim()));
  const hasUnsavedOptionChanges = JSON.stringify(draft) !== JSON.stringify(toDraft(options));

  function updateOption(index: number, patch: Partial<DraftOption>) {
    setDraft((current) => current.map((option, optionIndex) => optionIndex === index ? { ...option, ...patch } : option));
  }

  function updateValue(optionIndex: number, valueIndex: number, name: string) {
    setDraft((current) => current.map((option, currentOptionIndex) => currentOptionIndex === optionIndex ? {
      ...option,
      values: option.values.map((value, currentValueIndex) => currentValueIndex === valueIndex ? { ...value, name } : value),
    } : option));
  }

  async function saveOptions() {
    if (!isValid) return;
    await onSaveOptions({
      options: draft.map((option) => ({
        ...(option.id ? { id: option.id } : {}),
        name: option.name.trim(),
        values: option.values.map((value) => ({ ...(value.id ? { id: value.id } : {}), name: value.name.trim() })),
      })),
    });
  }

  async function generate() {
    if (!window.confirm(t('products.generate_variants_confirm', { count: projectedCount }))) return;
    await onGenerate();
  }

  async function removeVariant(variant: ProductVariant) {
    const message = variant.has_order_history
      ? t('products.delete_variant_history_confirm', { sku: variant.sku })
      : t('products.delete_variant_confirm', { sku: variant.sku });
    if (window.confirm(message)) await onDeleteVariant(variant);
  }

  return <Card className="overflow-hidden">
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-lg font-semibold">{t('products.options_variants')}</h2><p className="mt-1 text-sm text-slate-500">{t('products.options_help')}</p></div>
        <Button type="button" variant="secondary" onClick={() => setDraft((current) => [...current, { name: '', shared: false, values: [{ name: '' }] }])}>{t('products.add_option')}</Button>
      </div>

      {draft.length === 0 ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">{t('products.no_options')}</p> : <div className="space-y-4">
        {draft.map((option, optionIndex) => <div key={option.id ?? `new-${optionIndex}`} className="rounded-xl border border-slate-200 p-4">
          <div className="flex gap-2">
            <input value={option.name} disabled={option.shared} onChange={(event) => updateOption(optionIndex, { name: event.target.value })} aria-label={t('products.option_name')} placeholder={t('products.option_name')} className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm disabled:bg-slate-100"/>
            <Button type="button" variant="danger" onClick={() => setDraft((current) => current.filter((_, index) => index !== optionIndex))}>{t('common.remove')}</Button>
          </div>
          {option.shared && <p className="mt-2 text-xs text-slate-500">{t('products.shared_option_readonly')}</p>}
          <div className="mt-3 space-y-2">
            {option.values.map((value, valueIndex) => <div key={value.id ?? `new-${valueIndex}`} className="flex gap-2 pl-4">
              <input value={value.name} disabled={option.shared} onChange={(event) => updateValue(optionIndex, valueIndex, event.target.value)} aria-label={t('products.option_value')} placeholder={t('products.option_value')} className="h-9 flex-1 rounded-lg border border-slate-200 px-3 text-sm disabled:bg-slate-100"/>
              {!option.shared && <button type="button" onClick={() => updateOption(optionIndex, { values: option.values.filter((_, index) => index !== valueIndex) })} className="px-3 text-red-600" aria-label={t('common.remove')}>×</button>}
            </div>)}
            {!option.shared && <Button type="button" variant="secondary" onClick={() => updateOption(optionIndex, { values: [...option.values, { name: '' }] })}>{t('products.add_option_value')}</Button>}
          </div>
        </div>)}
      </div>}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-4">
        <p className="text-sm text-slate-600">{t('products.projected_variants', { count: projectedCount })}</p>
        <div className="flex gap-2">
          <Button type="button" variant="primary" disabled={!isValid || isSavingOptions} onClick={saveOptions}>{isSavingOptions ? t('common.saving') : t('products.save_options')}</Button>
          <Button type="button" variant="secondary" disabled={!isValid || hasUnsavedOptionChanges || isGenerating || projectedCount > 1000} onClick={generate}>{isGenerating ? t('products.generating_variants') : t('products.generate_variants')}</Button>
        </div>
      </div>
      {hasUnsavedOptionChanges && <p className="text-sm text-amber-700">{t('products.save_options_before_generate')}</p>}
      {projectedCount > 1000 && <p className="text-sm text-red-600">{t('products.variant_limit')}</p>}
    </div>

    {(variants.length > 1 || options.length > 0) && <div className="overflow-x-auto border-t"><table className="w-full"><thead className="bg-slate-50"><tr>{['sku', 'options', 'price', 'stock', 'actions'].map((key) => <th key={key} className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500">{t(`products.column_${key}`)}</th>)}</tr></thead><tbody className="divide-y">{variants.map((variant) => <tr key={variant.id}><td className="px-6 py-4 text-sm font-medium">{variant.sku}</td><td className="px-6 py-4 text-sm">{variant.option_values.map((value) => `${value.option_name}: ${value.value_name}`).join(' / ') || '—'}</td><td className="px-6 py-4 text-sm">{variant.formatted_price ?? variant.base_price}</td><td className="px-6 py-4 text-sm">{variant.stock}</td><td className="px-6 py-4"><div className="flex gap-2"><Button type="button" variant="secondary" onClick={() => onEditVariant(variant)}>{t('common.edit')}</Button><Button type="button" variant="danger" disabled={variants.length <= 1 || isDeleting} onClick={() => removeVariant(variant)}>{t('common.delete')}</Button></div>{variant.has_order_history && <p className="mt-1 text-xs text-amber-700">{t('products.variant_has_order_history')}</p>}</td></tr>)}</tbody></table></div>}
  </Card>;
}

function toDraft(options: ProductOption[]): DraftOption[] {
  return options.map((option) => ({ id: option.id, name: option.name, shared: option.shared, values: option.values.map((value) => ({ id: value.id, name: value.name })) }));
}
