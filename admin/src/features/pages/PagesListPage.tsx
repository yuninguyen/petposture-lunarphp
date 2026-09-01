import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import toast from 'react-hot-toast';
import { usePages, useDeletePage, useBulkDeletePages, Page } from './api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { SearchIcon, PlusIcon, PencilIcon, TrashIcon, DotsVerticalIcon } from '@/components/ui/icons';

const columnHelper = createColumnHelper<Page>();

export function PagesListPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [rowSelection, setRowSelection] = useState({});

  const { data, isLoading } = usePages(page, search);
  const deleteMutation = useDeletePage();
  const bulkDeleteMutation = useBulkDeletePages();

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleClearSearch = () => {
    setSearch('');
    setSearchInput('');
    setPage(1);
  };

  const handleDelete = (id: number, title: string, isCore: boolean) => {
    if (isCore) {
      toast.error(t('pages.core_warning', { defaultValue: 'This is a required legal page and cannot be deleted.' }));
      return;
    }
    if (window.confirm(t('pages.confirm_delete', { title, defaultValue: `Delete "${title}"? This cannot be undone.` }))) {
      deleteMutation.mutate(id, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['pages'] });
          setRowSelection({});
          toast.success(t('pages.delete_success', { defaultValue: 'Page deleted successfully' }));
        },
        onError: (err: any) => {
          toast.error(err.message || t('common.error_occurred'));
        }
      });
    }
  };

  const handleBulkDelete = () => {
    const selectedIds = Object.keys(rowSelection).map((idx) => {
      return data?.data[parseInt(idx)]?.id;
    }).filter(Boolean) as number[];

    if (!selectedIds.length) return;

    if (window.confirm(t('pages.bulk_confirm_delete', { count: selectedIds.length }))) {
      bulkDeleteMutation.mutate(selectedIds, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['pages'] });
          setRowSelection({});
          toast.success(t('pages.delete_success', { defaultValue: 'Pages deleted successfully' }));
        },
        onError: (err: any) => {
          toast.error(err.message || t('common.error_occurred'));
        }
      });
    }
  };

  const columns = useMemo(() => [
    columnHelper.display({
      id: 'select',
      header: ({ table }) => (
        <input
          type="checkbox"
          className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
          checked={table.getIsAllRowsSelected()}
          onChange={table.getToggleAllRowsSelectedHandler()}
        />
      ),
      cell: ({ row }) => {
        // Disable selection for core pages
        const isCore = row.original.is_core;
        return (
          <input
            type="checkbox"
            className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4 disabled:opacity-50 cursor-pointer"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            disabled={isCore}
          />
        );
      },
    }),
    columnHelper.accessor('title', {
      header: t('pages.header_title', 'Title'),
      cell: (info) => (
        <div>
          <div className="font-medium text-ink">{info.getValue()}</div>
          {info.row.original.is_core && (
            <Badge color="blue" className="mt-1">
              Core
            </Badge>
          )}
        </div>
      ),
    }),
    columnHelper.accessor('slug', {
      header: t('pages.header_slug', 'Slug'),
      cell: (info) => <div className="text-gray-500 text-sm">/{info.getValue()}</div>,
    }),
    columnHelper.accessor('status', {
      header: t('pages.header_status', 'Status'),
      cell: (info) => {
        const status = info.getValue();
        const color = status === 'published' ? 'emerald' : status === 'invisible' ? 'blue' : 'slate';

        return (
          <Badge color={color} className="capitalize">
            {t(`pages.status_${status}`, status)}
          </Badge>
        );
      },
    }),
    columnHelper.accessor('updated_at', {
      header: t('pages.header_updated', 'Updated'),
      cell: (info) => <div className="text-gray-500 text-sm whitespace-nowrap">{new Date(info.getValue()).toLocaleDateString()}</div>,
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end items-center gap-2">
          <Link to={`/legal-policies/${row.original.id}`} className="p-2 text-gray-400 hover:text-ink transition-colors">
            <PencilIcon className="h-4 w-4" />
          </Link>
          {!row.original.is_core && (
            <button
              onClick={() => handleDelete(row.original.id, row.original.title, row.original.is_core)}
              className="p-2 text-gray-400 hover:text-red-600 transition-colors"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    }),
  ], [t, deleteMutation, queryClient]);

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    state: {
      rowSelection,
    },
    onRowSelectionChange: setRowSelection,
  });

  const selectedCount = Object.keys(rowSelection).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">{t('pages.list_title', 'Legal & Policies')}</h1>
        </div>
        <Link to="/legal-policies/create">
          <Button variant="primary" className="w-full sm:w-auto">
            <PlusIcon className="h-4 w-4" />
            {t('pages.new_page', 'New Page')}
          </Button>
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <form onSubmit={handleSearchSubmit} className="flex-1 w-full relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder={t('pages.search_placeholder', 'Search by title or slug...')}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 bg-white border-slate-200 focus:border-primary/50 focus:ring-primary/20"
            />
            {search && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm font-medium"
              >
                Clear
              </button>
            )}
          </form>

          {selectedCount > 0 && (
            <Button variant="danger" onClick={handleBulkDelete} disabled={bulkDeleteMutation.isPending} className="whitespace-nowrap">
              <TrashIcon className="h-4 w-4 mr-1.5" />
              {t('pages.bulk_delete_selected', { count: selectedCount })}
            </Button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 bg-slate-50 uppercase border-b border-slate-200">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="px-6 py-4 font-medium whitespace-nowrap">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-8 text-center text-slate-500">
                    <div className="flex justify-center items-center gap-2">
                      <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
                      Loading...
                    </div>
                  </td>
                </tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-3 bg-slate-50 rounded-full">
                        <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l6 6v10a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <p>{search ? t('pages.empty_no_results') : t('pages.empty_no_pages')}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-6 py-4 align-middle">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {data?.last_page && data.last_page > 1 && (
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50/50">
            <span className="text-sm text-slate-500">
              {t('pages.pagination_page_of', { current: data.current_page, last: data.last_page })}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                Prev
              </Button>
              <Button
                variant="secondary"
                disabled={page === data.last_page}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
