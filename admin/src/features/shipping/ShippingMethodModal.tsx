import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  buildShippingMethodCreatePayload,
  buildShippingMethodUpdatePayload,
  ShippingMethod,
  ShippingMethodFormValues,
  useCreateShippingMethod,
  useUpdateShippingMethod,
} from './api';

interface ShippingMethodModalProps {
  open: boolean;
  method: ShippingMethod | null;
  onClose: () => void;
}

const emptyValues: ShippingMethodFormValues = { code: '', name: '', eta: '', price: '', free_over: '' };

export function ShippingMethodModal({ open, method, onClose }: ShippingMethodModalProps) {
  const { t } = useTranslation();
  const isEditing = method !== null;
  const createMutation = useCreateShippingMethod();
  const updateMutation = useUpdateShippingMethod();
  const isPending = createMutation.isPending || updateMutation.isPending;
  const [values, setValues] = useState<ShippingMethodFormValues>(emptyValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setValues(method ? {
      code: method.code,
      name: method.name,
      eta: method.eta ?? '',
      price: String(method.price),
      free_over: method.free_over == null ? '' : String(method.free_over),
    } : emptyValues);
    setErrors({});
  }, [method, open]);

  function validate(): boolean {
    const nextErrors: Record<string, string> = {};
    if (!values.code.trim() && !isEditing) nextErrors.code = t('shipping.validation.code_required');
    if (values.code.trim() && !/^[A-Za-z0-9_-]+$/.test(values.code)) nextErrors.code = t('shipping.validation.code_format');
    if (!values.name.trim()) nextErrors.name = t('shipping.validation.name_required');
    if (values.price.trim() === '' || !Number.isFinite(Number(values.price)) || Number(values.price) < 0) nextErrors.price = t('shipping.validation.non_negative_required');
    if (values.free_over.trim() !== '' && (!Number.isFinite(Number(values.free_over)) || Number(values.free_over) < 0)) nextErrors.free_over = t('shipping.validation.non_negative');
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;
    const onSuccess = () => {
      toast.success(t(isEditing ? 'shipping.update_success' : 'shipping.create_success'));
      onClose();
    };
    const onError = (error: Error) => toast.error(error.message || t('shipping.save_error'));
    if (method) {
      updateMutation.mutate({ id: method.id, payload: buildShippingMethodUpdatePayload(values) }, { onSuccess, onError });
    } else {
      createMutation.mutate(buildShippingMethodCreatePayload(values), { onSuccess, onError });
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={() => !isPending && onClose()}>
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{t(isEditing ? 'shipping.edit_title' : 'shipping.create_title')}</h2>
          <button type="button" onClick={onClose} disabled={isPending} className="text-2xl leading-none text-slate-400 hover:text-slate-600" aria-label={t('shipping.close')}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 p-5">
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{t('shipping.live_checkout_warning')}</p>
            <div>
              <label htmlFor="shipping-code" className="mb-1 block text-sm font-medium text-slate-700">{t('shipping.code')}</label>
              <Input id="shipping-code" value={values.code} readOnly={isEditing} disabled={isEditing} onChange={(event) => setValues({ ...values, code: event.target.value })} />
              {isEditing && <p className="mt-1 text-xs text-slate-500">{t('shipping.code_readonly')}</p>}
              {errors.code && <p className="mt-1 text-xs text-red-600">{errors.code}</p>}
            </div>
            <div>
              <label htmlFor="shipping-name" className="mb-1 block text-sm font-medium text-slate-700">{t('shipping.name')}</label>
              <Input id="shipping-name" value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
            </div>
            <div>
              <label htmlFor="shipping-eta" className="mb-1 block text-sm font-medium text-slate-700">{t('shipping.eta')}</label>
              <Input id="shipping-eta" value={values.eta} onChange={(event) => setValues({ ...values, eta: event.target.value })} />
            </div>
            <div>
              <label htmlFor="shipping-price" className="mb-1 block text-sm font-medium text-slate-700">{t('shipping.price')}</label>
              <Input id="shipping-price" type="number" min="0" step="0.01" value={values.price} onChange={(event) => setValues({ ...values, price: event.target.value })} />
              {errors.price && <p className="mt-1 text-xs text-red-600">{errors.price}</p>}
            </div>
            <div>
              <label htmlFor="shipping-free-over" className="mb-1 block text-sm font-medium text-slate-700">{t('shipping.free_over')}</label>
              <Input id="shipping-free-over" type="number" min="0" step="0.01" value={values.free_over} onChange={(event) => setValues({ ...values, free_over: event.target.value })} />
              {errors.free_over && <p className="mt-1 text-xs text-red-600">{errors.free_over}</p>}
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>{t('shipping.cancel')}</Button>
            <Button type="submit" variant="primary" disabled={isPending}>{t(isPending ? 'shipping.saving' : isEditing ? 'shipping.save' : 'shipping.create')}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
