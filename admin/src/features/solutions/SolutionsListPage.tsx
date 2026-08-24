import { useEffect, useState } from 'react';
import { useReactTable, getCoreRowModel, createColumnHelper, flexRender, type RowSelectionState } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useSolutions, useDeleteSolution, useBulkDeleteSolutions, Solution } from './solutionsApi';
import { SolutionRowActions } from './SolutionRowActions';
import { SolutionDetailModal } from './SolutionDetailModal';
import { DeleteConfirmModal } from '@/components/ui/delete-confirm-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import toast from 'react-hot-toast';

const columnHelper = createColumnHelper<Solution>();

export function SolutionsListPage() {
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [viewingSolutionId, setViewingSolutionId] = useState<number | null>(null);
  const [deletingSolution, setDeletingSolution] = useState<Solution | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const { data: solutionsPage, isLoading } = useSolutions({ search, page });
  const deleteMutation = useDeleteSolution();
  const bulkDeleteMutation = useBulkDeleteSolutions();

  function handleDelete(solution: Solution) {
    setDeletingSolution(solution);
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
      header: t('solutions.name', 'Name'),
      cell: (info) => (
        <span className="font-semibold text-slate-900">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor('slug', {
      header: t('solutions.slug', 'Slug'),
      cell: (info) => <span className="text-slate-500">{info.getValue()}</span>,
    }),
    columnHelper.accessor('products_count', {
      header: t('solutions.products', 'Products'),
      cell: (info) => <span className="text-slate-700 font-medium">{info.getValue() ?? 0}</span>,
    }),
    columnHelper.accessor('posts_count', {
      header: t('solutions.posts', 'Posts'),
      cell: (info) => <span className="text-slate-700 font-medium">{info.getValue() ?? 0}</span>,
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <div className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{t('common.actions', 'Actions')}</div>,
      cell: (info) => (
        <SolutionRowActions
          solution={info.row.original}
          onDelete={handleDelete}
          onView={(solution) => setViewingSolutionId(solution.id)}
        />
      ),
    }),
  ];

  const solutions = solutionsPage?.data ?? [];
  const table = useReactTable({
    data: solutions,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => String(row.id),
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
  });

  const meta = solutionsPage?.meta;
  const selectedCount = Object.keys(rowSelection).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('solutions.title', 'Solutions')}</h1>
        <Link to="/solutions/new">
          <Button variant="primary" className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            {t('solutions.new_solution', 'New Solution')}
          </Button>
        </Link>
      </div>

      {/* Filters & Actions */}
      <div className="bg-white rounded-t-xl border border-b-0 border-slate-200 p-4 flex items-center justify-between gap-4">
        <div className="flex-1 max-w-sm relative">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <Input
            type="text"
            placeholder={t('solutions.search', 'Search solutions...')}
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
              variant="danger"
              onClick={handleBulkDelete}
            >
              {t('solutions.bulk_delete_selected', 'Delete selected ({{count}})', { count: selectedCount })}
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
                    <th key={header.id} className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
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
              ) : solutions.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto text-slate-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
                    </svg>
                    <p className="text-base font-medium text-slate-900 mb-1">{t('solutions.no_results', 'No solutions found.')}</p>
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
                variant="secondary"
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                {t('common.previous', 'Previous')}
              </Button>
              <Button
                variant="secondary"
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
        open={!!deletingSolution}
        onClose={() => setDeletingSolution(null)}
        onConfirm={() => {
          if (!deletingSolution) return;
          deleteMutation.mutate(deletingSolution.id, {
            onSuccess: () => {
              setDeletingSolution(null);
              toast.success(t('solutions.delete_success', 'Solution deleted successfully'));
            },
            onError: (err: any) => {
              toast.error(err.message || t('common.error_occurred'));
              setDeletingSolution(null);
            }
          });
        }}
        title={t('common.delete', 'Delete')}
        message={t('solutions.delete_confirm', 'Are you sure you want to delete this solution?')}
        isLoading={deleteMutation.isPending}
      />

      {/* Bulk Delete Confirmation */}
      <DeleteConfirmModal
        open={bulkDeleting}
        onClose={() => setBulkDeleting(false)}
        onConfirm={() => {
          const ids = Object.keys(rowSelection).map(Number);
          bulkDeleteMutation.mutate(ids, {
            onSuccess: () => {
              setBulkDeleting(false);
              setRowSelection({});
              toast.success(t('solutions.bulk_delete_success', 'Solutions deleted successfully'));
            },
            onError: (err: any) => {
              toast.error(err.message || t('common.error_occurred'));
              setBulkDeleting(false);
            }
          });
        }}
        title={t('common.delete', 'Delete')}
        message={t('solutions.bulk_confirm_delete', 'Are you sure you want to delete {{count}} selected solutions?', { count: selectedCount })}
        isLoading={bulkDeleteMutation.isPending}
      />

      <SolutionDetailModal
        solutionId={viewingSolutionId}
        onClose={() => setViewingSolutionId(null)}
      />
    </div>
  );
}
