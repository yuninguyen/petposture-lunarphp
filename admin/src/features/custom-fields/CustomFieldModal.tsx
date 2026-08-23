import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchableMultiSelect } from '@/components/ui/SearchableMultiSelect';
import type { ProductType } from '@/features/product-types/api';
import { createCustomField, CustomField, updateCustomField } from './api';
import {
  buildCreatePayload,
  buildUpdatePayload,
  customFieldFormSchema,
  CustomFieldFormValues,
  generateHandle,
} from './customFieldSchema';

interface CustomFieldModalProps {
  open: boolean;
  field: CustomField | null;
  productTypes: ProductType[];
  onClose: () => void;
}

const emptyValues: CustomFieldFormValues = {
  name: '',
  handle: '',
  target: 'product',
  field_type: 'text',
  required: false,
  product_type_ids: [],
};

export function CustomFieldModal({ open, field, productTypes, onClose }: CustomFieldModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isEditing = field !== null;
  const [values, setValues] = useState<CustomFieldFormValues>(emptyValues);
  const [handleEdited, setHandleEdited] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setValues(field ? {
      name: field.name,
      handle: field.handle,
      target: field.target,
      field_type: 'text',
      required: field.required,
      product_type_ids: field.product_type_ids,
    } : emptyValues);
    setHandleEdited(Boolean(field));
    setErrors({});
  }, [field, open]);

  const saveMutation = useMutation({
    mutationFn: (formValues: CustomFieldFormValues) => field
      ? updateCustomField(field.id, buildUpdatePayload(formValues))
      : createCustomField(buildCreatePayload(formValues)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields'] });
      toast.success(t(isEditing ? 'custom_fields.update_success' : 'custom_fields.create_success'));
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message || t('common.error_occurred'));
    },
  });

  function setName(name: string) {
    setValues((current) => ({
      ...current,
      name,
      ...(!isEditing && !handleEdited ? { handle: generateHandle(name) } : {}),
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = customFieldFormSchema.safeParse(values);
    if (!result.success) {
      const nextErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        nextErrors[issue.path.join('.')] = t(issue.message);
      });
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    saveMutation.mutate(result.data);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={() => !saveMutation.isPending && onClose()}>
      <div className="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {t(isEditing ? 'custom_fields.edit_title' : 'custom_fields.create_title')}
          </h2>
          <button type="button" onClick={onClose} disabled={saveMutation.isPending} className="text-2xl leading-none text-slate-400 hover:text-slate-600" aria-label={t('common.close', 'Close')}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="max-h-[75vh] space-y-4 overflow-y-auto p-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">{t('custom_fields.name')} *</label>
              <Input value={values.name} onChange={(event) => setName(event.target.value)} />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t('custom_fields.handle')}</label>
                <Input
                  value={values.handle}
                  disabled={isEditing}
                  onChange={(event) => {
                    setHandleEdited(true);
                    setValues((current) => ({ ...current, handle: generateHandle(event.target.value) }));
                  }}
                  className={isEditing ? 'bg-slate-100' : ''}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t('custom_fields.target')}</label>
                <select
                  value={values.target}
                  disabled={isEditing}
                  onChange={(event) => setValues((current) => ({ ...current, target: event.target.value as 'product' | 'variant' }))}
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm disabled:bg-slate-100"
                >
                  <option value="product">{t('custom_fields.target_product')}</option>
                  <option value="variant">{t('custom_fields.target_variant')}</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t('custom_fields.type')}</label>
                <Input value={t('custom_fields.type_text')} disabled className="bg-slate-100" />
              </div>
              <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={values.required} onChange={(event) => setValues((current) => ({ ...current, required: event.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-primary" />
                {t('custom_fields.required')}
              </label>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">{t('custom_fields.product_types')} *</label>
              <SearchableMultiSelect
                options={productTypes.map((productType) => ({ id: productType.id, label: productType.name }))}
                value={values.product_type_ids}
                onChange={(product_type_ids) => setValues((current) => ({ ...current, product_type_ids }))}
                placeholder={t('custom_fields.search_product_types')}
              />
              {errors.product_type_ids && <p className="mt-1 text-xs text-red-600">{errors.product_type_ids}</p>}
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
            <Button type="button" variant="primary" onClick={onClose} disabled={saveMutation.isPending}>{t('custom_fields.cancel')}</Button>
            <Button type="submit" variant="secondary" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? t('custom_fields.saving') : t(isEditing ? 'custom_fields.save' : 'custom_fields.create')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
