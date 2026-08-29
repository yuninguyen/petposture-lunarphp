import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { fetchProducts, type ProductSummary } from '@/features/products/api';
import { Button } from '@/components/ui/button';
import { fetchCollectionProducts, syncCollectionProducts, type CollectionProduct } from './api';

interface Props { collectionId: number; collectionName: string; onClose: () => void }

export function CollectionProductsPanel({ collectionId, collectionName, onClose }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<CollectionProduct[]>([]);
  const productsQuery = useQuery({ queryKey: ['collection-products', collectionId], queryFn: () => fetchCollectionProducts(collectionId) });
  const candidatesQuery = useQuery({ queryKey: ['products', 'collection-assignment', search], queryFn: () => fetchProducts({ search, per_page: 20 }), enabled: search.trim().length > 1 });
  useEffect(() => { if (productsQuery.data) setSelected(productsQuery.data); }, [productsQuery.data]);
  const saveMutation = useMutation({
    mutationFn: () => syncCollectionProducts(collectionId, { product_ids: selected.map((product) => product.id) }),
    onSuccess: (data) => { setSelected(data); queryClient.invalidateQueries({ queryKey: ['collection-products', collectionId] }); toast.success(t('collections.products_update_success')); },
    onError: (error: Error) => toast.error(error.message || t('collections.products_update_error')),
  });
  function add(product: ProductSummary) { if (!selected.some((item) => item.id === product.id)) setSelected((items) => [...items, { id: product.id, name: product.name, slug: null, position: items.length }]); }
  function remove(id: number) { setSelected((items) => items.filter((item) => item.id !== id)); }
  function move(index: number, direction: -1 | 1) { const target = index + direction; if (target < 0 || target >= selected.length) return; const next = [...selected]; [next[index], next[target]] = [next[target], next[index]]; setSelected(next); }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label={t('collections.manage_products_for', { name: collectionName })}>
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="text-lg font-semibold text-slate-900">{t('collections.manage_products')}</h2><p className="text-sm text-slate-500">{collectionName}</p></div><button type="button" onClick={onClose} className="text-2xl text-slate-400" aria-label={t('common.close')}>×</button></div>
        <div className="grid min-h-0 gap-5 overflow-auto p-5 md:grid-cols-2">
          <section><label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="product-search">{t('collections.add_products')}</label><input id="product-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('collections.search_products')} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />{candidatesQuery.data?.data.map((product) => <button type="button" key={product.id} onClick={() => add(product)} className="mt-2 flex w-full items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50"><span>{product.name}</span><span className="text-secondary">{t('collections.add')}</span></button>)}</section>
          <section><h3 className="mb-2 text-sm font-medium text-slate-700">{t('collections.assigned_products', { count: selected.length })}</h3>{selected.length === 0 ? <p className="text-sm text-slate-500">{t('collections.no_products_assigned')}</p> : selected.map((product, index) => <div key={product.id} className="mb-2 flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm"><span className="min-w-0 flex-1 truncate">{product.name || `Product #${product.id}`}</span><button type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label={t('collections.move_product_up')} className="text-slate-500 disabled:opacity-30">↑</button><button type="button" disabled={index === selected.length - 1} onClick={() => move(index, 1)} aria-label={t('collections.move_product_down')} className="text-slate-500 disabled:opacity-30">↓</button><button type="button" onClick={() => remove(product.id)} className="text-red-600">{t('collections.remove')}</button></div>)}</section>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4"><Button type="button" variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button type="button" variant="primary" disabled={saveMutation.isPending || productsQuery.isLoading} onClick={() => saveMutation.mutate()}>{saveMutation.isPending ? t('common.saving') : t('collections.save_products')}</Button></div>
      </div>
    </div>
  );
}
