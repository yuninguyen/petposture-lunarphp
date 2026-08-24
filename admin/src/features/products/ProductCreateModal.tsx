import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createProductSchema, type CreateProductValues } from './ProductSchema';
import type { ProductType } from '@/features/product-types/api';

export function ProductCreateModal({ open, productTypes, isSaving, onClose, onSubmit }: { open: boolean; productTypes: ProductType[]; isSaving: boolean; onClose: () => void; onSubmit: (values: CreateProductValues) => Promise<void> }) {
  const { t } = useTranslation();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateProductValues>({ resolver: zodResolver(createProductSchema), defaultValues: { name: '', product_type_id: '' as any, sku: '', base_price: '' } });
  useEffect(() => { if (!open) reset(); }, [open, reset]);
  if (!open) return null;
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4" onMouseDown={onClose}><form onSubmit={handleSubmit(onSubmit)} onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
    <div className="mb-6 flex items-start justify-between"><div><h2 className="text-xl font-bold text-slate-900">{t('products.create_title')}</h2><p className="mt-1 text-sm text-slate-500">{t('products.create_help')}</p></div><button type="button" onClick={onClose} className="text-2xl text-slate-400">×</button></div>
    <div className="space-y-4">
      <Field label={t('products.name')} error={errors.name?.message && t(String(errors.name.message))}><Input autoFocus {...register('name')} /></Field>
      <Field label={t('products.product_type')} error={errors.product_type_id?.message && t(String(errors.product_type_id.message))}><select {...register('product_type_id')} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="">{t('products.select_product_type')}</option>{productTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></Field>
      <div className="grid grid-cols-2 gap-4"><Field label={t('products.sku')} error={errors.sku?.message && t(String(errors.sku.message))}><Input {...register('sku')} /></Field><Field label={t('products.base_price')} error={errors.base_price?.message && t(String(errors.base_price.message))}><Input inputMode="decimal" {...register('base_price')} /></Field></div>
    </div>
    <div className="mt-7 flex justify-end gap-3"><Button type="button" variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button type="submit" variant="primary" disabled={isSaving}>{isSaving ? t('common.saving', 'Saving...') : t('products.create')}</Button></div>
  </form></div>;
}
function Field({ label, error, children }: { label: string; error?: string | false; children: React.ReactNode }) { return <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>{children}{error && <span className="mt-1 block text-xs text-red-600">{error}</span>}</label>; }
