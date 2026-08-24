import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  useCreateProductAssociation,
  useDeleteProductAssociation,
  useProductAssociations,
  useProducts,
  type ProductAssociation,
  type ProductAssociationType,
  type ProductSummary,
} from './api';

const associationTypes: ProductAssociationType[] = ['cross-sell', 'up-sell', 'alternate'];

export function ProductAssociationsEditor({ productId }: { productId: number }) {
  const { t } = useTranslation();
  const [type, setType] = useState<ProductAssociationType>('cross-sell');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedTarget, setSelectedTarget] = useState<ProductSummary | null>(null);
  const associationsQuery = useProductAssociations(productId);
  const productsQuery = useProducts({ search, per_page: 20 });
  const createMutation = useCreateProductAssociation();
  const deleteMutation = useDeleteProductAssociation();

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const associations = associationsQuery.data ?? [];
  const candidates = (productsQuery.data?.data ?? []).filter((product) => product.id !== productId);

  async function addAssociation() {
    if (!selectedTarget) return;
    try {
      await createMutation.mutateAsync({ productId, targetProductId: selectedTarget.id, type });
      toast.success(t('products.association_add_success'));
      setSelectedTarget(null);
      setSearchInput('');
      setSearch('');
    } catch (error: any) {
      toast.error(error.message || t('common.error_occurred'));
    }
  }

  async function removeAssociation(association: ProductAssociation) {
    if (!window.confirm(t('products.association_remove_confirm', { name: association.target.name }))) return;
    try {
      await deleteMutation.mutateAsync({ productId, associationId: association.id });
      toast.success(t('products.association_remove_success'));
    } catch (error: any) {
      toast.error(error.message || t('common.error_occurred'));
    }
  }

  return <Card className="space-y-5 p-6">
    <div><h2 className="text-lg font-semibold">{t('products.associations')}</h2><p className="mt-1 text-sm text-slate-500">{t('products.associations_help')}</p></div>

    <div className="grid gap-3 md:grid-cols-[180px_1fr_auto] md:items-start">
      <select value={type} onChange={(event) => setType(event.target.value as ProductAssociationType)} aria-label={t('products.association_type')} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm">
        {associationTypes.map((value) => <option key={value} value={value}>{t(`products.association_${value}`)}</option>)}
      </select>
      <div className="relative">
        <Input value={searchInput} onChange={(event) => { setSearchInput(event.target.value); setSelectedTarget(null); }} placeholder={t('products.search_association_target')}/>
        {searchInput && !selectedTarget && <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          {productsQuery.isLoading ? <p className="px-3 py-2 text-sm text-slate-500">{t('common.loading')}</p> : candidates.length === 0 ? <p className="px-3 py-2 text-sm text-slate-500">{t('products.no_association_targets')}</p> : candidates.map((product) => <button key={product.id} type="button" onClick={() => { setSelectedTarget(product); setSearchInput(product.name); }} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-slate-50">{product.thumbnail ? <img src={product.thumbnail} alt="" className="h-9 w-9 rounded object-cover"/> : <span className="h-9 w-9 rounded bg-slate-100"/>}<span><span className="block text-sm font-medium text-slate-800">{product.name}</span><span className="block text-xs text-slate-500">{product.product_type.name} · {t(`products.status_${product.status}`)}</span></span></button>)}
        </div>}
      </div>
      <Button type="button" variant="primary" disabled={!selectedTarget || createMutation.isPending} onClick={addAssociation}>{createMutation.isPending ? t('common.saving') : t('products.add_association')}</Button>
    </div>

    {associationsQuery.isLoading ? <p className="text-sm text-slate-500">{t('common.loading')}</p> : associations.length === 0 ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">{t('products.no_associations')}</p> : <div className="divide-y rounded-xl border border-slate-200">{associations.map((association) => <div key={association.id} className="flex items-center justify-between gap-4 p-4"><div className="flex min-w-0 items-center gap-3">{association.target.thumbnail ? <img src={association.target.thumbnail} alt="" className="h-11 w-11 rounded-lg object-cover"/> : <span className="h-11 w-11 shrink-0 rounded-lg bg-slate-100"/>}<div className="min-w-0"><p className="truncate font-medium text-slate-900">{association.target.name}</p><p className="text-xs text-slate-500">{t(`products.association_${association.type}`)} · {t(`products.status_${association.target.status}`)}</p></div></div><Button type="button" variant="danger" disabled={deleteMutation.isPending} onClick={() => removeAssociation(association)}>{t('common.remove')}</Button></div>)}</div>}
  </Card>;
}
