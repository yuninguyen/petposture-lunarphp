import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { createProductType, fetchProductTypes } from './api';

const queryKey = ['product-types'];

export function ProductTypesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');

  const productTypesQuery = useQuery({
    queryKey,
    queryFn: fetchProductTypes,
  });

  const createMutation = useMutation({
    mutationFn: createProductType,
    onSuccess: () => {
      setName('');
      queryClient.invalidateQueries({ queryKey });
      toast.success(t('product_types.create_success'));
    },
    onError: (error: Error) => {
      toast.error(error.message || t('common.error_occurred'));
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName) createMutation.mutate({ name: trimmedName });
  }

  const productTypes = productTypesQuery.data ?? [];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('product_types.title')}</h1>
      </div>

      <Card className="mb-6 shadow-sm">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="product-type-name" className="mb-1 block text-sm font-medium text-slate-700">
              {t('product_types.name')}
            </label>
            <Input
              id="product-type-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('product_types.name_placeholder')}
              required
            />
          </div>
          <Button type="submit" variant="secondary" disabled={createMutation.isPending || !name.trim()}>
            {createMutation.isPending ? t('product_types.creating') : t('product_types.create')}
          </Button>
        </form>
      </Card>

      <Card className="p-0 overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-700">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                {t('product_types.name')}
              </th>
              <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t('product_types.products')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {productTypesQuery.isLoading ? (
              <tr>
                <td colSpan={2} className="px-6 py-12 text-center text-slate-500">
                  {t('product_types.loading')}
                </td>
              </tr>
            ) : productTypesQuery.isError ? (
              <tr>
                <td colSpan={2} className="px-6 py-12 text-center text-red-600">
                  {productTypesQuery.error instanceof Error
                    ? productTypesQuery.error.message
                    : t('common.error_occurred')}
                </td>
              </tr>
            ) : productTypes.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-6 py-12 text-center text-slate-500">
                  {t('product_types.empty')}
                </td>
              </tr>
            ) : (
              productTypes.map((productType) => (
                <tr key={productType.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-6 py-4 font-semibold text-slate-900">{productType.name}</td>
                  <td className="px-6 py-4 text-right text-slate-700">{productType.products_count}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
