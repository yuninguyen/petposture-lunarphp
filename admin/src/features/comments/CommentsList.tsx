import { useEffect, useState } from 'react';
import { useReactTable, getCoreRowModel, createColumnHelper, flexRender, type RowSelectionState } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchComments, bulkDeleteComments, deleteComment, Comment } from './api';
import { CommentRowActions } from './CommentRowActions';
import { Link } from 'react-router-dom';
import { DeleteConfirmModal } from '@/components/ui/delete-confirm-modal';
import { CommentModal } from './CommentModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import toast from 'react-hot-toast';
import { Badge } from '@/components/ui/badge';

const columnHelper = createColumnHelper<Comment>();

export function CommentsList() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | 'pending' | 'approved' | 'rejected'>('');
  const [page, setPage] = useState(1);
  const [deletingComment, setDeletingComment] = useState<Comment | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search, status]);

  const { data: commentsPage, isLoading, refetch } = useQuery({
    queryKey: ['comments-list', page, search, status],
    queryFn: () => fetchComments(page, search, status),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteComment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments-list'] });
      setRowSelection({});
      setDeletingComment(null);
      toast.success(t('comments.delete_success', { defaultValue: 'Comment deleted successfully' }));
    },
    onError: (err: any) => {
      toast.error(err.message || t('common.error_occurred'));
      setDeletingComment(null);
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: bulkDeleteComments,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments-list'] });
      setRowSelection({});
      setBulkDeleting(false);
      toast.success(t('comments.bulk_delete_success', { defaultValue: 'Comments deleted successfully' }));
    },
    onError: (err: any) => {
      toast.error(err.message || t('common.error_occurred'));
      setBulkDeleting(false);
    }
  });

  function handleDelete(comment: Comment) {
    setDeletingComment(comment);
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
        />
      ),
      cell: ({ row }) => (
        <input type="checkbox" checked={row.getIsSelected()} onChange={row.getToggleSelectedHandler()} />
      ),
    }),
    columnHelper.accessor((row) => row.post?.title ?? String(row.post_id), { 
      id: 'post', 
      header: t('comments.header_post', 'Post')
    }),
    columnHelper.accessor('customer_name', { 
      header: t('comments.header_customer', 'Customer Name'),
      cell: (info) => <span className="font-semibold text-ink">{info.getValue()}</span>
    }),
    columnHelper.accessor('status', {
      header: t('comments.header_status', 'Status'),
      cell: (info) => {
        const val = info.getValue();
        const color = val === 'approved' ? 'emerald' : val === 'rejected' ? 'red' : 'amber';
        return (
          <Badge color={color}>
            {t(`comments.status_${val}`, val)}
          </Badge>
        );
      },
    }),
    columnHelper.accessor('created_at', {
      header: t('comments.header_created', 'Created At'),
      cell: (info) => new Date(info.getValue()).toLocaleDateString(),
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: (info) => <CommentRowActions comment={info.row.original} onDelete={() => handleDelete(info.row.original)} />,
    }),
  ];

  const comments = commentsPage?.data ?? [];
  const table = useReactTable({
    data: comments,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => String(row.id),
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
  });

  const hasFilters = Boolean(search || status);
  const selectedCount = Object.keys(rowSelection).length;
  const meta = commentsPage?.meta;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('comments.list_title', 'Comments')}</h1>
        <Button onClick={() => setIsCreateModalOpen(true)} variant="primary" className="flex items-center gap-2 shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          {t('comments.new', 'New Comment')}
        </Button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </div>
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t('comments.search_placeholder', 'Search by customer...')}
                className="pl-9 w-full bg-white border-slate-200 focus:ring-2 focus:ring-primary/20 transition-colors text-sm py-2 h-[38px] shadow-sm rounded-lg"
              />
            </div>
            
            {/* Status Dropdown */}
            <div className="relative">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as '' | 'pending' | 'approved' | 'rejected')}
                className="appearance-none w-full px-3 py-2 pr-8 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white hover:bg-slate-50 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors cursor-pointer shadow-sm h-[38px]"
              >
                <option value="">{t('comments.filter_status_all', 'All Statuses')}</option>
                <option value="pending">{t('comments.status_pending', 'Pending')}</option>
                <option value="approved">{t('comments.status_approved', 'Approved')}</option>
                <option value="rejected">{t('comments.status_rejected', 'Rejected')}</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                </svg>
              </div>
            </div>
          </div>

          {/* Right side Bulk Action */}
          {selectedCount > 0 && (
            <Button 
              type="button" 
              variant="danger"
              className="whitespace-nowrap shadow-sm h-[38px]"
              onClick={handleBulkDelete}
            >
              {t('comments.bulk_delete_selected', { count: selectedCount })}
            </Button>
          )}
        </div>

      {/* Table Area */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12 bg-white rounded-xl shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <svg className="animate-spin h-6 w-6 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-sm font-medium">{t('comments.loading', 'Loading comments...')}</p>
          </div>
        </div>
      ) : comments.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white rounded-xl shadow-sm ring-1 ring-slate-200 text-center">
          <svg className="mx-auto h-12 w-12 text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <h3 className="text-sm font-semibold text-slate-900">
            {hasFilters ? t('comments.empty_no_results', 'No comments matched your filter') : t('comments.empty_no_comments', 'No comments found')}
          </h3>
          {!hasFilters && (
            <p className="mt-1 text-sm text-slate-500">Wait for users to leave comments.</p>
          )}
        </div>
      ) : (
        <div className="bg-white shadow-sm ring-1 ring-slate-200 rounded-xl flex flex-col">
          <div className="w-full">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((header) => (
                      <th 
                        key={header.id} 
                        scope="col"
                        className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors group">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {meta && meta.last_page > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-6 py-3">
              <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-slate-600">
                    {t('comments.pagination_page_of', { current: meta.current_page, last: meta.last_page })}
                  </p>
                </div>
                <div>
                  <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                    <button
                      onClick={() => setPage((p) => p - 1)}
                      disabled={page <= 1}
                      className="relative inline-flex items-center rounded-l-md px-3 py-2 text-slate-400 bg-white ring-1 ring-inset ring-slate-300 hover:bg-slate-50 hover:text-slate-500 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <span className="sr-only">Previous</span>
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page >= meta.last_page}
                      className="relative inline-flex items-center rounded-r-md px-3 py-2 text-slate-400 bg-white ring-1 ring-inset ring-slate-300 hover:bg-slate-50 hover:text-slate-500 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <span className="sr-only">Next</span>
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      <DeleteConfirmModal
        open={!!deletingComment}
        onClose={() => setDeletingComment(null)}
        onConfirm={() => deletingComment && deleteMutation.mutate(deletingComment.id)}
        title={t('comments.title', { defaultValue: 'Delete Comment' })}
        message={t('comments.confirm_delete_message')}
        isLoading={deleteMutation.isPending}
      />

      <DeleteConfirmModal
        open={bulkDeleting}
        onClose={() => setBulkDeleting(false)}
        onConfirm={() => bulkDeleteMutation.mutate(Object.keys(rowSelection).map(Number))}
        title={t('comments.title', { defaultValue: 'Delete Comments' })}
        message={t('comments.bulk_confirm_delete', { count: selectedCount })}
        isLoading={bulkDeleteMutation.isPending}
      />

      <CommentModal open={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
    </div>
  );
}
