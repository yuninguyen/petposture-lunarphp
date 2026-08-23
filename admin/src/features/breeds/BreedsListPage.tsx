import { useEffect, useState } from 'react';
import { useReactTable, getCoreRowModel, createColumnHelper, flexRender, type RowSelectionState } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useBreeds, useDeleteBreed, useBulkDeleteBreeds, Breed } from './breedsApi';
import { BreedRowActions } from './BreedRowActions';
import { BreedDetailModal } from './BreedDetailModal';
import { DeleteConfirmModal } from '@/components/ui/delete-confirm-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import toast from 'react-hot-toast';

const columnHelper = createColumnHelper<Breed>();

export function BreedsListPage() {
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [viewingBreedId, setViewingBreedId] = useState<number | null>(null);
  const [deletingBreed, setDeletingBreed] = useState<Breed | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const { data: breedsPage, isLoading } = useBreeds({ search, page });
  const deleteMutation = useDeleteBreed();
  const bulkDeleteMutation = useBulkDeleteBreeds();

  function handleDelete(breed: Breed) {
    setDeletingBreed(breed);
  }

  function handleBulkDelete() {
    const ids = Object.keys(rowSelection).map(Number);
    if (ids.length === 0) return;
    setBulkDeleting(true);
  }

  const columns = [
    columnHelper.display({
      id: 'select',
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllPageRowsSelected()}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
          className="rounded border-slate-300 text-primary focus:ring-primary"
        />
      ),
      cell: ({ row }) => (
        <input 
          type="checkbox" 
          checked={row.getIsSelected()} 
          onChange={row.getToggleSelectedHandler()} 
          className="rounded border-slate-300 text-primary focus:ring-primary"
        />
      ),
    }),
    columnHelper.accessor('name', {
      header: t('breeds.name', 'Name'),
      cell: (info) => (
        <span className="font-semibold text-slate-900">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor('slug', {
      header: t('breeds.slug', 'Slug'),
      cell: (info) => <span className="text-slate-500">{info.getValue()}</span>,
    }),
    columnHelper.accessor('body_type', {
      header: t('breeds.body_type', 'Body Type'),
      cell: (info) => {
        const val = info.getValue();
        if (!val) return '-';
        // Convert slug to Title Case (e.g., long-backed -> Long Backed)
        const formatted = val
          .split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        return <span className="text-slate-600">{formatted}</span>;
      },
    }),
    columnHelper.accessor('products_count', {
      header: t('breeds.products', 'Products'),
      cell: (info) => <span className="text-slate-700 font-medium">{info.getValue() ?? 0}</span>,
    }),
    columnHelper.accessor('posts_count', {
      header: t('breeds.posts', 'Posts'),
      cell: (info) => <span className="text-slate-700 font-medium">{info.getValue() ?? 0}</span>,
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: (info) => (
        <BreedRowActions
          breed={info.row.original}
          onDelete={handleDelete}
          onView={(breed) => setViewingBreedId(breed.id)}
        />
      ),
    }),
  ];

  const breeds = breedsPage?.data ?? [];
  const table = useReactTable({
    data: breeds,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => String(row.id),
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
  });

  const meta = breedsPage?.meta;
  const selectedCount = Object.keys(rowSelection).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('breeds.title', 'Breeds')}</h1>
        <Button asChild>
          <Link to="/breeds/new" className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            {t('breeds.new_breed', 'New Breed')}
          </Link>
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
            placeholder={t('breeds.search', 'Search breeds...')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-10"
          />
        </div>

        {selectedCount > 0 && (
          <div className="flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
            <span className="text-sm font-medium text-slate-500">
              {selectedCount} selected
            </span>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
            >
              {t('breeds.bulk_delete_selected', 'Delete selected ({{count}})', { count: selectedCount })}
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-b-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-slate-200 bg-slate-50">
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="px-4 py-3 text-sm font-semibold text-slate-700 whitespace-nowrap first:w-12">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500">
                    <div className="flex justify-center mb-2">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                    {t('common.loading', 'Loading...')}
                  </td>
                </tr>
              ) : breeds.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto text-slate-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
                    </svg>
                    <p className="text-base font-medium text-slate-900 mb-1">{t('breeds.no_results', 'No breeds found.')}</p>
                    <p className="text-sm">{t('common.try_different_search', 'Try adjusting your search')}</p>
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 transition-colors group">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 text-sm">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {meta && meta.last_page > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-sm text-slate-500">
              {t('common.pagination_page_of', 'Page {{current}} of {{last}}', { current: meta.current_page, last: meta.last_page })}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                {t('common.previous', 'Previous')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= meta.last_page}
                onClick={() => setPage(p => p + 1)}
              >
                {t('common.next', 'Next')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <DeleteConfirmModal
        isOpen={!!deletingBreed}
        onClose={() => setDeletingBreed(null)}
        onConfirm={() => {
          if (!deletingBreed) return;
          deleteMutation.mutate(deletingBreed.id, {
            onSuccess: () => {
              setDeletingBreed(null);
              toast.success(t('breeds.delete_success', 'Breed deleted successfully'));
            },
            onError: (err: any) => {
              toast.error(err.message || t('common.error_occurred'));
              setDeletingBreed(null);
            }
          });
        }}
        title={t('breeds.delete_confirm', 'Are you sure you want to delete this breed?')}
        description={deletingBreed?.name || ''}
        isDeleting={deleteMutation.isLoading}
      />

      {/* Bulk Delete Confirmation */}
      <DeleteConfirmModal
        isOpen={bulkDeleting}
        onClose={() => setBulkDeleting(false)}
        onConfirm={() => {
          const ids = Object.keys(rowSelection).map(Number);
          bulkDeleteMutation.mutate(ids, {
            onSuccess: () => {
              setBulkDeleting(false);
              setRowSelection({});
              toast.success(t('breeds.bulk_delete_success', 'Breeds deleted successfully'));
            },
            onError: (err: any) => {
              toast.error(err.message || t('common.error_occurred'));
              setBulkDeleting(false);
            }
          });
        }}
        title={t('breeds.bulk_confirm_delete', 'Are you sure you want to delete {{count}} selected breeds?', { count: selectedCount })}
        isDeleting={bulkDeleteMutation.isLoading}
      />

      <BreedDetailModal 
        breedId={viewingBreedId} 
        onClose={() => setViewingBreedId(null)} 
      />
    </div>
  );
}
