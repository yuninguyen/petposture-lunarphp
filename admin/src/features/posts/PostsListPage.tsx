import { useEffect, useState } from 'react';
import { useReactTable, getCoreRowModel, createColumnHelper, flexRender, type RowSelectionState } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { usePosts, useDeletePost, useBulkDeletePosts, useDuplicatePost, Post } from './postsApi';
import { fetchJson } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const columnHelper = createColumnHelper<Post>();

interface BlogCategoryOption {
  id: number;
  name: string;
  slug: string;
}

const TYPE_BADGE_CLASSES: Record<Post['type'], string> = {
  article: 'bg-gray-200 text-gray-600',
  guide: 'bg-blue-100 text-blue-700',
  comparison: 'bg-amber-100 text-amber-700',
};

export function PostsListPage() {
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | 'draft' | 'published'>('');
  const [category, setCategory] = useState('');
  const [type, setType] = useState<'' | 'article' | 'guide' | 'comparison'>('');
  const [page, setPage] = useState(1);
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
    if (window.confirm(t('posts.confirm_delete', { title: post.title }))) {
      deletePost.mutate(post.id);
    }
  }

  function handleBulkDelete() {
    const ids = Object.keys(rowSelection);
    if (ids.length === 0) return;
    if (window.confirm(t('posts.bulk_confirm_delete', { count: ids.length }))) {
      bulkDeletePosts.mutate(ids, {
        onSuccess: () => setRowSelection({}),
      });
    }
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
    columnHelper.accessor('title', {
      header: t('posts.header_title'),
      cell: (info) => (
        <div className="flex items-center gap-2">
          <Link to={`/posts/${info.row.original.id}`} className="text-primary font-semibold hover:underline">
            {info.getValue()}
          </Link>
          {info.row.original.has_out_of_stock_comparison_items && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
              ⚠ {t('posts.badge_out_of_stock')}
            </span>
          )}
        </div>
      ),
    }),
    columnHelper.accessor((row) => row.blog_category?.name ?? '—', { id: 'category', header: t('posts.header_category') }),
    columnHelper.accessor('type', {
      header: t('posts.header_type'),
      cell: (info) => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${TYPE_BADGE_CLASSES[info.getValue()]}`}>
          {t(`posts.type.${info.getValue()}`)}
        </span>
      ),
    }),
    columnHelper.accessor('status', {
      header: t('posts.header_status'),
      cell: (info) => (
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
            info.getValue() === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
          }`}
        >
          {info.getValue() === 'published' ? t('posts.status_published') : t('posts.status_draft')}
        </span>
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
        <div className="flex items-center gap-3 justify-end">
          {info.row.original.status === 'published' && (
            <a
              href={`${import.meta.env.VITE_FRONTEND_URL}/blog/${info.row.original.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              {t('posts.action_view')}
            </a>
          )}
          <button type="button" onClick={() => duplicatePost.mutate(info.row.original.id)} className="text-xs text-primary hover:underline">
            {t('posts.action_duplicate')}
          </button>
          <button type="button" onClick={() => handleDelete(info.row.original)} className="text-xs text-red-600 hover:underline">
            {t('posts.action_delete')}
          </button>
        </div>
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
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-ink">{t('posts.list_title')}</h1>
        <Link to="/posts/new">
          <Button variant="secondary">{t('posts.new_post')}</Button>
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t('posts.search_placeholder')}
          className="max-w-xs"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as '' | 'draft' | 'published')}
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm"
        >
          <option value="">{t('posts.filter_status_all')}</option>
          <option value="draft">{t('posts.status_draft')}</option>
          <option value="published">{t('posts.status_published')}</option>
        </select>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as '' | 'article' | 'guide' | 'comparison')}
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm"
        >
          <option value="">{t('posts.filter_type_all')}</option>
          <option value="article">{t('posts.type.article')}</option>
          <option value="guide">{t('posts.type.guide')}</option>
          <option value="comparison">{t('posts.type.comparison')}</option>
        </select>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm"
        >
          <option value="">{t('posts.filter_category_all')}</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        {selectedCount > 0 && (
          <Button type="button" variant="primary" onClick={handleBulkDelete}>
            {t('posts.bulk_delete_selected', { count: selectedCount })}
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">{t('posts.loading')}</p>
      ) : posts.length === 0 ? (
        <p className="text-sm text-gray-500">{hasFilters ? t('posts.empty_no_results') : t('posts.empty_no_posts')}</p>
      ) : (
        <>
          <table className="w-full bg-white border border-gray-200 rounded-xl overflow-hidden">
            <thead className="bg-gray-50">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => (
                    <th key={header.id} className="text-left px-4 py-2 text-xs font-semibold text-primary-light uppercase">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-t border-gray-100">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-sm">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {meta && meta.last_page > 1 && (
            <div className="flex items-center justify-between mt-4">
              <Button type="button" variant="primary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                {t('posts.pagination_prev')}
              </Button>
              <span className="text-xs text-gray-500">
                {t('posts.pagination_page_of', { current: meta.current_page, last: meta.last_page })}
              </span>
              <Button type="button" variant="primary" disabled={page >= meta.last_page} onClick={() => setPage((p) => p + 1)}>
                {t('posts.pagination_next')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
