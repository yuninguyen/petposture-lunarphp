import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { createProductType, deleteProductType, fetchProductTypes, updateProductType, type ProductType } from './api';
import { ProductTypeRowActions } from './ProductTypeRowActions';

const queryKey = ['product-types'];

export function ProductTypesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<ProductType | null>(null);
  const productTypesQuery = useQuery({ queryKey, queryFn: fetchProductTypes });
  const createMutation = useMutation({ mutationFn: createProductType, onSuccess: () => { setName(''); queryClient.invalidateQueries({ queryKey }); toast.success(t('product_types.create_success')); }, onError: (e: Error) => toast.error(e.message || t('common.error_occurred')) });
  const updateMutation = useMutation({ mutationFn: ({ id, name }: { id: number; name: string }) => updateProductType(id, { name }), onSuccess: () => { setEditing(null); setName(''); queryClient.invalidateQueries({ queryKey }); toast.success(t('product_types.update_success')); }, onError: (e: Error) => toast.error(e.message || t('common.error_occurred')) });
  const deleteMutation = useMutation({ mutationFn: deleteProductType, onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success(t('product_types.delete_success')); }, onError: (e: Error) => toast.error(e.message || t('common.error_occurred')) });
  function handleSubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const trimmed = name.trim(); if (!trimmed) return; editing ? updateMutation.mutate({ id: editing.id, name: trimmed }) : createMutation.mutate({ name: trimmed }); }
  function beginEdit(type: ProductType) { setEditing(type); setName(type.name); }
  function remove(type: ProductType) { if (type.products_count > 0) { toast.error(t('product_types.delete_in_use')); return; } if (window.confirm(t('product_types.delete_confirm', { name: type.name }))) deleteMutation.mutate(type.id); }
  const productTypes = productTypesQuery.data ?? [];
  return <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8"><div className="mb-6"><h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('product_types.title')}</h1></div><Card className="mb-6 shadow-sm"><form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end"><div className="flex-1"><label htmlFor="product-type-name" className="mb-1 block text-sm font-medium text-slate-700">{t('product_types.name')}</label><Input id="product-type-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('product_types.name_placeholder')} required /></div><Button type="submit" variant="primary" disabled={createMutation.isPending || updateMutation.isPending || !name.trim()}>{createMutation.isPending || updateMutation.isPending ? t('common.saving') : editing ? t('product_types.save') : t('product_types.create')}</Button>{editing && <Button type="button" variant="secondary" onClick={() => { setEditing(null); setName(''); }}>{t('common.cancel')}</Button>}</form></Card><Card className="overflow-hidden p-0 shadow-sm"><table className="w-full text-left text-sm text-slate-600"><thead className="border-b border-slate-200 bg-slate-50 text-slate-700"><tr><th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">{t('product_types.name')}</th><th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">{t('product_types.products')}</th><th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">{t('product_types.actions')}</th></tr></thead><tbody className="divide-y divide-slate-200 bg-white">{productTypesQuery.isLoading ? <tr><td colSpan={3} className="px-6 py-12 text-center">{t('product_types.loading')}</td></tr> : productTypesQuery.isError ? <tr><td colSpan={3} className="px-6 py-12 text-center text-red-600">{(productTypesQuery.error as Error).message}</td></tr> : productTypes.length === 0 ? <tr><td colSpan={3} className="px-6 py-12 text-center">{t('product_types.empty')}</td></tr> : productTypes.map((type) => <tr key={type.id} className="hover:bg-slate-50"><td className="px-6 py-4 font-semibold text-slate-900">{type.name}</td><td className="px-6 py-4 text-right">{type.products_count}</td><td className="px-6 py-4 text-right"><ProductTypeRowActions productType={type} onEdit={beginEdit} onDelete={remove} /></td></tr>)}</tbody></table></Card></div>;
}
