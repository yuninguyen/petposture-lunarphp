import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Brand, createBrand, updateBrand } from './api';
import { BrandFormValues, brandFormSchema, buildBrandPayload } from './brandSchema';

interface BrandModalProps {
  open: boolean;
  brand: Brand | null;
  onClose: () => void;
}

const emptyValues: BrandFormValues = { name: '' };

export function BrandModal({ open, brand, onClose }: BrandModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isEditing = brand !== null;
  const [values, setValues] = useState<BrandFormValues>(emptyValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setValues(brand ? { name: brand.name } : emptyValues);
    setErrors({});
  }, [brand, open]);

  const saveMutation = useMutation({
    mutationFn: (formValues: BrandFormValues) => brand
      ? updateBrand(brand.id, buildBrandPayload(formValues))
      : createBrand(buildBrandPayload(formValues)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      toast.success(t(isEditing ? 'brands.update_success' : 'brands.create_success'));
      onClose();
    },
    onError: (error: Error) => toast.error(error.message || t('common.error_occurred')),
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = brandFormSchema.safeParse(values);
    if (!result.success) {
      const nextErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => { nextErrors[issue.path.join('.')] = t(issue.message); });
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    saveMutation.mutate(result.data);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={() => !saveMutation.isPending && onClose()}>
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{t(isEditing ? 'brands.edit_title' : 'brands.create_title')}</h2>
          <button type="button" onClick={onClose} disabled={saveMutation.isPending} className="text-2xl leading-none text-slate-400 hover:text-slate-600" aria-label={t('common.close')}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="space-y-5 p-5">
            <div>
              <label htmlFor="brand-name" className="mb-1 block text-sm font-medium text-slate-700">{t('brands.name')} *</label>
              <Input id="brand-name" value={values.name} onChange={(event) => setValues({ name: event.target.value })} />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saveMutation.isPending}>{t('brands.cancel')}</Button>
            <Button type="submit" variant="primary" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? t('brands.saving') : t(isEditing ? 'brands.save' : 'brands.create')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
