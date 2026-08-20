import { useReactTable, getCoreRowModel, createColumnHelper, flexRender } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import { usePosts, Post } from './postsApi';
import { Button } from '@/components/ui/button';

const columnHelper = createColumnHelper<Post>();

const columns = [
  columnHelper.accessor('title', {
    header: 'Tiêu đề',
    cell: (info) => (
      <Link to={`/posts/${info.row.original.id}`} className="text-primary font-semibold hover:underline">
        {info.getValue()}
      </Link>
    ),
  }),
  columnHelper.accessor((row) => row.blog_category?.name ?? '—', { id: 'category', header: 'Chuyên mục' }),
  columnHelper.accessor('status', {
    header: 'Trạng thái',
    cell: (info) => (
      <span
        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
          info.getValue() === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
        }`}
      >
        {info.getValue() === 'published' ? 'Đã đăng' : 'Nháp'}
      </span>
    ),
  }),
];

export function PostsListPage() {
  const { data: posts, isLoading } = usePosts();

  const table = useReactTable({
    data: posts ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-ink">Bài viết</h1>
        <Link to="/posts/new">
          <Button variant="secondary">Bài viết mới</Button>
        </Link>
      </div>
      {isLoading ? (
        <p className="text-sm text-gray-500">Đang tải...</p>
      ) : (
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
      )}
    </div>
  );
}
