import { useEffect, useState } from 'react';
import { useReactTable, getCoreRowModel, createColumnHelper, flexRender } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { usePosts, useDeletePost, Post } from './postsApi';
import { fetchJson } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const columnHelper = createColumnHelper<Post>();

interface BlogCategoryOption {
  id: number;
  name: string;
  slug: string;
}

export function PostsListPage() {
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | 'draft' | 'published'>('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search, status, category]);

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
    page,
  });

  const deletePost = useDeletePost();

  function handleDelete(post: Post) {
    if (window.confirm(t('posts.confirm_delete', { title: post.title }))) {
      deletePost.mutate(post.id);
    }
  }

  const columns = [
    columnHelper.accessor('title', {
      header: t('posts.header_title'),
      cell: (info) => (
        <Link to={`/posts/${info.row.original.id}`} className="text-primary font-semibold hover:underline">
          {info.getValue()}
        </Link>
      ),
    }),
    columnHelper.accessor((row) => row.blog_category?.name ?? '—', { id: 'category', header: t('posts.header_category') }),
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
  });

  const hasFilters = Boolean(search || status || category);
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
