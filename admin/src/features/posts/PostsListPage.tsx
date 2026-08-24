import { useEffect, useState } from 'react';
import { useReactTable, getCoreRowModel, createColumnHelper, flexRender, type RowSelectionState } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { usePosts, useDeletePost, useBulkDeletePosts, useDuplicatePost, Post } from './postsApi';
import { PostRowActions } from './PostRowActions';
import { fetchJson } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DeleteConfirmModal } from '@/components/ui/delete-confirm-modal';

import { ReactNode } from 'react';

const columnHelper = createColumnHelper<Post>();

interface BlogCategoryOption {
  id: number;
  name: string;
  slug: string;
}

const BADGE_COLORS = {
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  slate: 'bg-slate-50 text-slate-700 border-slate-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  red: 'bg-red-50 text-red-700 border-red-200',
};

function Badge({ children, color = 'slate', className = '' }: { children: ReactNode; color?: keyof typeof BADGE_COLORS; className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-md text-xs font-semibold border ${BADGE_COLORS[color]} ${className}`}>
      {children}
    </span>
  );
}

const TYPE_BADGE_COLORS: Record<Post['type'], keyof typeof BADGE_COLORS> = {
  article: 'slate',
  guide: 'blue',
  comparison: 'amber',
};

export function PostsListPage() {
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | 'draft' | 'published'>('');
  const [category, setCategory] = useState('');
  const [type, setType] = useState<'' | 'article' | 'guide' | 'comparison'>('');
  const [page, setPage] = useState(1);
  const [deletingPost, setDeletingPost] = useState<Post | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search, status, category, type]);

  const { data: categories } = useQuery({
    queryKey: ['blog-categories'],
    queryFn: async () => {
      const res = await fetchJson<BlogCategoryOption[]>('/admin/blog/categories');
      return Array.isArray(res) ? res : [];
    },
  });

  const { data: postsPage, isLoading } = usePosts({
    search: search || undefined,
    status: status || undefined,
    category: category || undefined,
    type: type || undefined,
    page,
  });

  const deletePost = useDeletePost();
  const bulkDeletePosts = useBulkDeletePosts();
  const duplicatePost = useDuplicatePost();

  function handleDelete(post: Post) {
    setDeletingPost(post);
  }

  function handleBulkDelete() {
    const ids = Object.keys(rowSelection);
    if (ids.length === 0) return;
    setBulkDeleting(true);
  }

  const handleDeleteConfirm = () => {
    if (deletingPost) {
      deletePost.mutate(deletingPost.id, {
        onSuccess: () => setDeletingPost(null),
        onError: (err: any) => {
          alert(err.message || t('common.error_occurred'));
          setDeletingPost(null);
        }
      });
    }
  };

  const handleBulkDeleteConfirm = () => {
    bulkDeletePosts.mutate(Object.keys(rowSelection), {
      onSuccess: () => {
        setRowSelection({});
        setBulkDeleting(false);
      },
      onError: (err: any) => {
        alert(err.message || t('common.error_occurred'));
        setBulkDeleting(false);
      }
    });
  };

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
    columnHelper.accessor('title', {
      header: t('posts.header_title'),
      cell: (info) => (
        <div className="flex items-center gap-2">
          <span className="font-semibold text-ink">{info.getValue()}</span>
          {info.row.original.has_out_of_stock_comparison_items && (
            <Badge color="red" className="ml-2 gap-1 shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {t('posts.badge_out_of_stock')}
            </Badge>
          )}
        </div>
      ),
    }),
    columnHelper.accessor((row) => row.blog_category?.name ?? '—', { id: 'category', header: t('posts.header_category') }),
    columnHelper.accessor('type', {
      header: t('posts.header_type'),
      cell: (info) => (
        <Badge color={TYPE_BADGE_COLORS[info.getValue()]}>
          {t(`posts.type.${info.getValue()}`)}
        </Badge>
      ),
    }),
    columnHelper.accessor('status', {
      header: t('posts.header_status'),
      cell: (info) => (
        <Badge color={info.getValue() === 'published' ? 'emerald' : 'slate'}>
          {info.getValue() === 'published' ? t('posts.status_published') : t('posts.status_draft')}
        </Badge>
      ),
    }),
    columnHelper.accessor('updated_at', {
      header: t('posts.header_updated'),
      cell: (info) => new Date(info.getValue()).toLocaleDateString(),
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: (info) => (
        <PostRowActions
          post={info.row.original}
          onDuplicate={(post) => duplicatePost.mutate(post.id)}
          onDelete={handleDelete}
        />
      ),
    }),
  ];

  const posts = postsPage?.data ?? [];
  const table = useReactTable({
    data: posts,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => String(row.id),
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
  });

  const hasFilters = Boolean(search || status || category || type);
  const selectedCount = Object.keys(rowSelection).length;
  const meta = postsPage?.meta;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('posts.list_title')}</h1>
        <Link to="/posts/new">
          <Button variant="primary" className="flex items-center gap-2 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            {t('posts.new_post')}
          </Button>
        </Link>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        
        {/* Left side filters */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Search Input with Icon */}
            <div className="relative w-full sm:w-72">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </div>
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t('posts.search_placeholder')}
                className="pl-9 w-full bg-white border-slate-200 focus:ring-2 focus:ring-primary/20 transition-colors text-sm py-2 h-[38px] shadow-sm rounded-lg"
              />
            </div>
            
            {/* Filter Dropdowns */}
            <div className="relative">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as '' | 'draft' | 'published')}
                className="appearance-none w-full px-3 py-2 pr-8 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white hover:bg-slate-50 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors cursor-pointer shadow-sm h-[38px]"
              >
                <option value="">{t('posts.filter_status_all')}</option>
                <option value="draft">{t('posts.status_draft')}</option>
                <option value="published">{t('posts.status_published')}</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                </svg>
              </div>
            </div>
            
            <div className="relative">
              <select
                value={type}
                onChange={(e) => setType(e.target.value as '' | 'article' | 'guide' | 'comparison')}
                className="appearance-none w-full px-3 py-2 pr-8 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white hover:bg-slate-50 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors cursor-pointer shadow-sm h-[38px]"
              >
                <option value="">{t('posts.filter_type_all')}</option>
                <option value="article">{t('posts.type.article')}</option>
                <option value="guide">{t('posts.type.guide')}</option>
                <option value="comparison">{t('posts.type.comparison')}</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                </svg>
              </div>
            </div>
            
            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="appearance-none w-full px-3 py-2 pr-8 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white hover:bg-slate-50 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors cursor-pointer max-w-[200px] truncate shadow-sm h-[38px]"
              >
                <option value="">{t('posts.filter_category_all')}</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.slug}>
                    {c.name}
                  </option>
                ))}
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
              {t('posts.bulk_delete_selected', { count: selectedCount })}
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
            <p className="text-sm font-medium">{t('posts.loading')}</p>
          </div>
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white rounded-xl shadow-sm ring-1 ring-slate-200 text-center">
          <svg className="mx-auto h-12 w-12 text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-sm font-semibold text-slate-900">
            {hasFilters ? t('posts.empty_no_results') : t('posts.empty_no_posts')}
          </h3>
          {!hasFilters && (
            <p className="mt-1 text-sm text-slate-500">Get started by creating a new post.</p>
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
                    {t('posts.pagination_page_of', { current: meta.current_page, last: meta.last_page })}
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
        open={!!deletingPost}
        onClose={() => setDeletingPost(null)}
        onConfirm={handleDeleteConfirm}
        title={t('posts.action_delete', { defaultValue: 'Delete' })}
        message={t('posts.confirm_delete', { title: deletingPost?.title })}
        isLoading={deletePost.isPending}
      />

      <DeleteConfirmModal
        open={bulkDeleting}
        onClose={() => setBulkDeleting(false)}
        onConfirm={handleBulkDeleteConfirm}
        title={t('posts.action_delete', { defaultValue: 'Delete' })}
        message={t('posts.bulk_confirm_delete', { count: selectedCount })}
        isLoading={bulkDeletePosts.isPending}
      />
    </div>
  );
}
