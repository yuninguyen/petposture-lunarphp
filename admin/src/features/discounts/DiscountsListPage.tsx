import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { DeleteConfirmModal } from '@/components/ui/delete-confirm-modal';
import type { Discount, DiscountStatus } from './api';
import { useDeleteDiscount, useDiscounts } from './api';
import { DiscountRowActions } from './DiscountRowActions';

const statusClasses: Record<DiscountStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  expired: 'bg-red-100 text-red-700',
  pending: 'bg-slate-100 text-slate-600',
  scheduled: 'bg-blue-100 text-blue-700',
};

function displayDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : '—';
}

export function DiscountsListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deletingDiscount, setDeletingDiscount] = useState<Discount | null>(null);
  const discountsQuery = useDiscounts({ search, page });
  const deleteMutation = useDeleteDiscount();
  const discounts = discountsQuery.data?.data ?? [];
  const meta = discountsQuery.data?.meta;

  function changeSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function confirmDelete() {
    if (!deletingDiscount) return;
    deleteMutation.mutate(deletingDiscount.id, {
      onSuccess: () => {
        if (discounts.length === 1 && page > 1 && meta) setPage((current) => current - 1);
        toast.success(t('discounts.delete_success'));
        setDeletingDiscount(null);
      },
      onError: (error: Error) => toast.error(error.message || t('discounts.delete_error')),
    });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('discounts.title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('discounts.subtitle')}</p>
        </div>
        <Button variant="primary" onClick={() => navigate('/discounts/new')}>{t('discounts.create')}</Button>
      </div>

      <input aria-label={t('discounts.search')} value={search} onChange={(event) => changeSearch(event.target.value)} placeholder={t('discounts.search')} className="mb-4 w-full max-w-sm rounded-lg border border-slate-200 px-3 py-2 text-sm" />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead><tr className="border-b border-slate-200 bg-slate-50">
              {['name', 'type', 'status', 'coupon', 'starts', 'ends'].map((column) => <th key={column} className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">{t(`discounts.${column}`)}</th>)}
              <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">{t('discounts.actions')}</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-200">
              {discountsQuery.isLoading ? <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">{t('discounts.loading')}</td></tr>
                : discountsQuery.isError ? <tr><td colSpan={7} className="px-4 py-8 text-center text-red-600">{discountsQuery.error instanceof Error ? discountsQuery.error.message : t('discounts.error')}</td></tr>
                  : discounts.length === 0 ? <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">{t('discounts.empty')}</td></tr>
                    : discounts.map((discount) => <tr key={discount.id} className="hover:bg-slate-50">
                      <td className="px-6 py-3 text-sm font-semibold text-slate-900">{discount.name}</td>
                      <td className="px-6 py-3 text-sm text-slate-700">{discount.type_label || '—'}</td>
                      <td className="px-6 py-3 text-sm"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClasses[discount.status]}`}>{t(`discounts.status_${discount.status}`)}</span></td>
                      <td className="px-6 py-3 text-sm text-slate-700">{discount.coupon || '—'}</td>
                      <td className="px-6 py-3 text-sm text-slate-700">{displayDate(discount.starts_at)}</td>
                      <td className="px-6 py-3 text-sm text-slate-700">{displayDate(discount.ends_at)}</td>
                      <td className="px-6 py-3 text-right text-sm"><DiscountRowActions discount={discount} onEdit={(item) => navigate(`/discounts/${item.id}`)} onDelete={setDeletingDiscount} /></td>
                    </tr>)}
            </tbody>
          </table>
        </div>
      </div>

      {meta && <div className="mt-4 flex items-center justify-end gap-3 text-sm text-slate-600">
        <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>{t('discounts.previous')}</Button>
        <span>{t('discounts.page_of', { current: meta.current_page, last: meta.last_page })}</span>
        <Button variant="secondary" disabled={page >= meta.last_page} onClick={() => setPage((current) => current + 1)}>{t('discounts.next')}</Button>
      </div>}

      <DeleteConfirmModal open={deletingDiscount !== null} title={t('discounts.delete_title')} message={t('discounts.delete_warning', { name: deletingDiscount?.name ?? '' })} isLoading={deleteMutation.isPending} onClose={() => setDeletingDiscount(null)} onConfirm={confirmDelete} />
    </div>
  );
}
