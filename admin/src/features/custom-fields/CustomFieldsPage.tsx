import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DeleteConfirmModal } from '@/components/ui/delete-confirm-modal';
import { fetchProductTypes } from '@/features/product-types/api';
import { CustomField, deleteCustomField, fetchCustomFields } from './api';
import { CustomFieldModal } from './CustomFieldModal';
import { CustomFieldRowActions } from './CustomFieldRowActions';

export function CustomFieldsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [deletingField, setDeletingField] = useState<CustomField | null>(null);

  const customFieldsQuery = useQuery({ queryKey: ['custom-fields'], queryFn: fetchCustomFields });
  const productTypesQuery = useQuery({ queryKey: ['product-types'], queryFn: fetchProductTypes });

  const deleteMutation = useMutation({
    mutationFn: deleteCustomField,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success(t('custom_fields.delete_success'));
      setDeletingField(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || t('common.error_occurred'));
    },
  });

  const fields = customFieldsQuery.data ?? [];

  function openCreate() {
    setEditingField(null);
    setModalOpen(true);
  }

  function openEdit(field: CustomField) {
    setEditingField(field);
    setModalOpen(true);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('custom_fields.title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('custom_fields.subtitle')}</p>
        </div>
        <Button onClick={openCreate} disabled={productTypesQuery.isLoading}>{t('custom_fields.create')}</Button>
      </div>

      <Card className="overflow-x-auto p-0 shadow-sm">
        <table className="w-full min-w-[900px] text-left text-sm text-slate-600">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{t('custom_fields.name')}</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{t('custom_fields.handle')}</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{t('custom_fields.target')}</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{t('custom_fields.product_types')}</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{t('custom_fields.required')}</th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{t('common.actions', 'Actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {customFieldsQuery.isLoading ? (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-500">{t('custom_fields.loading')}</td></tr>
            ) : customFieldsQuery.isError ? (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-red-600">{customFieldsQuery.error instanceof Error ? customFieldsQuery.error.message : t('common.error_occurred')}</td></tr>
            ) : fields.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-500">{t('custom_fields.empty')}</td></tr>
            ) : fields.map((field) => (
              <tr key={field.id} className="hover:bg-slate-50">
                <td className="px-5 py-4 font-semibold text-slate-900">{field.name}</td>
                <td className="px-5 py-4 font-mono text-xs text-slate-700">{field.handle}</td>
                <td className="px-5 py-4">{t(`custom_fields.target_${field.target}`)}</td>
                <td className="px-5 py-4">
                  <div className="flex max-w-md flex-wrap gap-1">
                    {field.product_types.map((productType) => (
                      <span key={productType.id} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">{productType.name}</span>
                    ))}
                  </div>
                </td>
                <td className="px-5 py-4">{field.required ? t('custom_fields.yes') : t('custom_fields.no')}</td>
                <td className="px-5 py-4">
                  <CustomFieldRowActions 
                    field={field}
                    onEdit={openEdit}
                    onDelete={setDeletingField}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <CustomFieldModal
        open={modalOpen}
        field={editingField}
        productTypes={productTypesQuery.data ?? []}
        onClose={() => setModalOpen(false)}
      />

      <DeleteConfirmModal
        open={deletingField !== null}
        title={t('custom_fields.delete_title')}
        message={t('custom_fields.delete_message', { name: deletingField?.display_name ?? '' })}
        isLoading={deleteMutation.isPending}
        onClose={() => setDeletingField(null)}
        onConfirm={() => deletingField && deleteMutation.mutate(deletingField.id)}
      />
    </div>
  );
}
