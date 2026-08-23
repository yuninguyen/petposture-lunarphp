import { useEffect, useState } from 'react';
import { useReactTable, getCoreRowModel, createColumnHelper, flexRender, type RowSelectionState } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTags, deleteTag, bulkDeleteTags, BlogTag } from './api';
import { TagRowActions } from './TagRowActions';
import { TagModal } from './TagModal';
import { DeleteConfirmModal } from '@/components/ui/delete-confirm-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import toast from 'react-hot-toast';

const columnHelper = createColumnHelper<BlogTag>();

export function TagsList() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<BlogTag | null>(null);
  const [deletingTag, setDeletingTag] = useState<BlogTag | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const { data: tagsPage, isLoading } = useQuery({
    queryKey: ['tags-list', search, page],
    queryFn: () => fetchTags({ search, page }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTag,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags-list'] });
      setRowSelection({});
      setDeletingTag(null);
      toast.success(t('tags.delete_success', { defaultValue: 'Tag deleted successfully' }));
    },
    onError: (error: any) => {
      toast.error(error.message || t('common.error_occurred'));
      setDeletingTag(null);
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: bulkDeleteTags,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags-list'] });
      setRowSelection({});
      setBulkDeleting(false);
      toast.success(t('tags.bulk_delete_success', { defaultValue: 'Tags deleted successfully' }));
    },
    onError: (error: any) => {
      toast.error(error.message || t('common.error_occurred'));
      setBulkDeleting(false);
    }
  });

  function handleDelete(tag: BlogTag) {
    setDeletingTag(tag);
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
      header: t('tags.name', { defaultValue: 'NAME' }),
      cell: (info) => <span className="font-semibold text-slate-900">{info.getValue()}</span>,
    }),
    columnHelper.accessor('slug', {
      header: t('tags.slug', { defaultValue: 'SLUG' }),
      cell: (info) => <span className="text-slate-500">{info.getValue()}</span>,
    }),
    columnHelper.accessor('posts_count', {
      header: t('tags.posts', { defaultValue: 'POSTS' }),
      cell: (info) => <span className="text-slate-700">{info.getValue() ?? 0}</span>,
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: (info) => (
        <TagRowActions
          tag={info.row.original}
          onDelete={handleDelete}
          onEdit={(tag) => {
            setEditingTag(tag);
            setModalOpen(true);
          }}
        />
      ),
    }),
  ];

  const tags = tagsPage?.data ?? [];
  const table = useReactTable({
    data: tags,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => String(row.id),
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
  });

  const meta = tagsPage?.meta;
  const selectedCount = Object.keys(rowSelection).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('tags.title', { defaultValue: 'Tags' })}</h1>
        <Button 
          variant="secondary" 
          className="flex items-center gap-2 shadow-sm"
          onClick={() => {
            setEditingTag(null);
            setModalOpen(true);
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          {t('tags.new_tag', { defaultValue: 'New Tag' })}
        </Button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div className="relative w-full sm:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-4 w-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </div>
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('tags.search', { defaultValue: 'Search tags...' })}
            className="pl-9 w-full bg-white border-slate-200 focus:ring-2 focus:ring-primary/20 transition-colors text-sm py-2 h-[38px] shadow-sm rounded-lg"
          />
        </div>
        
        {/* Right side Bulk Action */}
        {selectedCount > 0 && (
          <Button 
            type="button" 
            variant="primary" 
            className="bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 whitespace-nowrap transition-colors shadow-sm h-[38px]"
            onClick={handleBulkDelete}
          >
            {t('tags.bulk_delete_selected', { count: selectedCount, defaultValue: `Delete ${selectedCount} selected` })}
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
        <div className="w-full">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th 
                      key={header.id} 
                      className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap"
                    >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-12 text-center text-slate-500">
                    <svg className="animate-spin h-5 w-5 mx-auto text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </td>
                </tr>
              ) : tags.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-12 text-center text-slate-500">
                    {t('tags.no_results', { defaultValue: 'No tags found.' })}
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-6 py-4 whitespace-nowrap">
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
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50/50">
            <span className="text-sm text-slate-500">
              Showing {(meta.current_page - 1) * meta.per_page + 1} to {Math.min(meta.current_page * meta.per_page, meta.total)} of {meta.total} results
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= meta.last_page}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        <TagModal 
          open={modalOpen} 
          onClose={() => setModalOpen(false)} 
          tag={editingTag} 
        />
        
        <DeleteConfirmModal
          open={!!deletingTag}
          onClose={() => setDeletingTag(null)}
          onConfirm={() => deletingTag && deleteMutation.mutate(deletingTag.id)}
          title={t('tags.delete')}
          message={t('tags.delete_confirm', { title: deletingTag?.name, defaultValue: 'Are you sure you want to delete this tag?' })}
          isLoading={deleteMutation.isPending}
        />

        <DeleteConfirmModal
          open={bulkDeleting}
          onClose={() => setBulkDeleting(false)}
          onConfirm={() => bulkDeleteMutation.mutate(Object.keys(rowSelection).map(Number))}
          title={t('tags.delete')}
          message={t('tags.bulk_confirm_delete', { count: selectedCount, defaultValue: `Are you sure you want to delete ${selectedCount} selected tags?` })}
          isLoading={bulkDeleteMutation.isPending}
        />
      </div>
    </div>
  );
}
