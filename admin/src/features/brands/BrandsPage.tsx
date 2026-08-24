import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DeleteConfirmModal } from '@/components/ui/delete-confirm-modal';
import { Brand, deleteBrand, fetchBrands } from './api';
import { BrandModal } from './BrandModal';
import { BrandRowActions } from './BrandRowActions';

interface ApiError extends Error {
  status?: number;
  data?: { code?: string; message?: string };
}

export function BrandsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [deletingBrand, setDeletingBrand] = useState<Brand | null>(null);
  const [searchInput, setSearchInput] = useState('');

  const brandsQuery = useQuery({ queryKey: ['brands'], queryFn: fetchBrands });
  const deleteMutation = useMutation({
    mutationFn: deleteBrand,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      toast.success(t('brands.delete_success', 'Brand deleted successfully'));
      setDeletingBrand(null);
    },
    onError: (error: ApiError) => {
      if (error.status === 409 && error.data?.code === 'BRAND_IN_USE') {
        toast.error(error.data.message || error.message);
        return;
      }
      toast.error(error.message || t('common.error_occurred'));
    },
  });

  const brands = brandsQuery.data ?? [];
  const filteredBrands = useMemo(() => {
    if (!searchInput.trim()) return brands;
    const lowerSearch = searchInput.toLowerCase();
    return brands.filter(b => b.name.toLowerCase().includes(lowerSearch));
  }, [brands, searchInput]);

  function openCreate() {
    setEditingBrand(null);
    setModalOpen(true);
  }

  function openEdit(brand: Brand) {
    setEditingBrand(brand);
    setModalOpen(true);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('brands.title', 'Brands')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('brands.subtitle', 'Manage product brands')}</p>
        </div>
        <Button variant="primary" className="flex items-center gap-2" onClick={openCreate}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          {t('brands.create', 'New Brand')}
        </Button>
      </div>

      {/* Filters & Actions */}
      <div className="bg-white rounded-t-xl border border-b-0 border-slate-200 p-4 flex items-center justify-between gap-4">
        <div className="flex-1 max-w-sm relative">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <Input
            type="text"
            placeholder={t('brands.search', 'Search brands...')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-b-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{t('brands.name', 'Name')}</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{t('brands.products', 'Products')}</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{t('common.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {brandsQuery.isLoading ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                    <div className="flex justify-center mb-2">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                    {t('common.loading')}
                  </td>
                </tr>
              ) : brandsQuery.isError ? (
                <tr>
                  <td colSpan={3} className="px-4 py-12 text-center text-red-600">
                    {brandsQuery.error instanceof Error ? brandsQuery.error.message : t('common.error_occurred')}
                  </td>
                </tr>
              ) : filteredBrands.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-12 text-center text-slate-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto text-slate-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
                    </svg>
                    <p className="text-base font-medium text-slate-900 mb-1">{t('brands.no_results', 'No brands found.')}</p>
                  </td>
                </tr>
              ) : (
                filteredBrands.map((brand) => (
                  <tr key={brand.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-3 text-sm font-semibold text-slate-900">
                      {brand.name}
                    </td>
                    <td className="px-6 py-3 text-sm text-slate-700 font-medium">
                      {brand.products_count}
                    </td>
                    <td className="px-6 py-3 text-sm">
                      <BrandRowActions 
                        brand={brand} 
                        onEdit={openEdit} 
                        onDelete={setDeletingBrand} 
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <BrandModal open={modalOpen} brand={editingBrand} onClose={() => setModalOpen(false)} />
      <DeleteConfirmModal
        open={deletingBrand !== null}
        title={t('common.delete', 'Delete')}
        message={t('brands.delete_message', { name: deletingBrand?.name ?? '' })}
        isLoading={deleteMutation.isPending}
        onClose={() => setDeletingBrand(null)}
        onConfirm={() => deletingBrand && deleteMutation.mutate(deletingBrand.id)}
      />
    </div>
  );
}
