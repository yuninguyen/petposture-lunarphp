import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { DeleteConfirmModal } from '@/components/ui/delete-confirm-modal';
import { ShippingMethod, useDeleteShippingMethod, useShippingMethods } from './api';
import { ShippingMethodModal } from './ShippingMethodModal';
import { ShippingRowActions } from './ShippingRowActions';

interface ApiError extends Error {
  status?: number;
  data?: { message?: string };
}

function displayValue(value: string | number | null): string {
  return value == null || value === '' ? '—' : String(value);
}

function displayMoney(value: string | number | null): string {
  if (value == null || value === '') return '—';
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `$${numeric.toFixed(2)}` : String(value);
}

export function ShippingMethodsPage() {
  const { t } = useTranslation();
  const shippingMethodsQuery = useShippingMethods();
  const deleteMutation = useDeleteShippingMethod();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<ShippingMethod | null>(null);
  const [deletingMethod, setDeletingMethod] = useState<ShippingMethod | null>(null);

  function openCreate() {
    setEditingMethod(null);
    setModalOpen(true);
  }

  function openEdit(method: ShippingMethod) {
    setEditingMethod(method);
    setModalOpen(true);
  }

  function deleteSelectedMethod() {
    if (!deletingMethod) return;
    deleteMutation.mutate(deletingMethod.id, {
      onSuccess: () => {
        toast.success(t('shipping.delete_success'));
        setDeletingMethod(null);
      },
      onError: (error: ApiError) => toast.error(error.status === 409 ? (error.data?.message || error.message) : (error.message || t('shipping.delete_error'))),
    });
  }

  const methods = shippingMethodsQuery.data ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('shipping.title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('shipping.subtitle')}</p>
        </div>
        <Button variant="primary" onClick={openCreate}>{t('shipping.create')}</Button>
      </div>

      <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{t('shipping.live_checkout_warning')}</p>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">{t('shipping.code')}</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">{t('shipping.name')}</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">{t('shipping.eta')}</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">{t('shipping.price')}</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">{t('shipping.free_over')}</th>
                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">{t('shipping.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {shippingMethodsQuery.isLoading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">{t('shipping.loading')}</td></tr>
              ) : shippingMethodsQuery.isError ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-red-600">{shippingMethodsQuery.error instanceof Error ? shippingMethodsQuery.error.message : t('shipping.error')}</td></tr>
              ) : methods.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">{t('shipping.empty')}</td></tr>
              ) : methods.map((method) => (
                <tr key={method.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 text-sm font-semibold text-slate-900">{method.code}</td>
                  <td className="px-6 py-3 text-sm text-slate-700">{method.name}</td>
                  <td className="px-6 py-3 text-sm text-slate-700">{displayValue(method.eta)}</td>
                  <td className="px-6 py-3 text-sm text-slate-700">{displayMoney(method.price)}</td>
                  <td className="px-6 py-3 text-sm text-slate-700">{displayMoney(method.free_over)}</td>
                  <td className="px-6 py-3 text-right text-sm">
                    <ShippingRowActions method={method} onEdit={openEdit} onDelete={setDeletingMethod} />

                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ShippingMethodModal open={modalOpen} method={editingMethod} onClose={() => setModalOpen(false)} />
      <DeleteConfirmModal
        open={deletingMethod !== null}
        title={t('shipping.delete_title')}
        message={t('shipping.delete_warning', { name: deletingMethod?.name ?? '' })}
        isLoading={deleteMutation.isPending}
        onClose={() => setDeletingMethod(null)}
        onConfirm={deleteSelectedMethod}
      />
    </div>
  );
}
