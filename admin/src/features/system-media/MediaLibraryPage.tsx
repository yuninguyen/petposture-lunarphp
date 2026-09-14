import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { DeleteConfirmModal } from '@/components/ui/delete-confirm-modal';
import { TrashIcon } from '@/components/ui/icons';
import {
  deleteMediaLibraryItem,
  fetchMediaLibrary,
  type MediaLibraryItem,
} from './api';

interface ApiError extends Error {
  status?: number;
  data?: {
    code?: string;
    message?: string;
    details?: {
      usages?: Array<{
        type: string;
        id: number;
        label: string;
      }>;
    };
  };
}

type SourceFilter = 'all' | 'curator' | 'spatie';

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function MediaLibraryPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [source, setSource] = useState<SourceFilter>('all');
  const [page, setPage] = useState<number>(1);
  const [deletingItem, setDeletingItem] = useState<MediaLibraryItem | null>(null);

  const { data: response, isLoading, isError } = useQuery({
    queryKey: ['media-library', source, page],
    queryFn: () => fetchMediaLibrary({ source, page, per_page: 24 }),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ itemSource, id }: { itemSource: string; id: number }) =>
      deleteMediaLibraryItem(itemSource, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-library'] });
      toast.success(
        t('media_library.delete_success', 'Media file deleted successfully')
      );
      setDeletingItem(null);
    },
    onError: (error: ApiError) => {
      if (error.status === 409 && error.data?.code === 'MEDIA_IN_USE') {
        const usagesList = error.data?.details?.usages ?? [];
        const formattedUsages = usagesList
          .map((u) => `${u.type} "${u.label}"`)
          .join(', ');
        toast.error(
          t('media_library.errors.in_use', {
            usages: formattedUsages,
            defaultValue: `Cannot delete — currently used by: ${formattedUsages}`,
          })
        );
        setDeletingItem(null);
        return;
      }
      toast.error(error.message || t('common.error_occurred', 'An error occurred'));
      setDeletingItem(null);
    },
  });

  const items = response?.data ?? [];
  const meta = response?.meta;
  const totalPages = meta?.last_page ?? 1;
  const currentPage = meta?.current_page ?? page;

  function handleSourceChange(newSource: SourceFilter) {
    setSource(newSource);
    setPage(1);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {t('media_library.title', 'Media Library')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {t(
              'media_library.subtitle',
              'Browse and manage uploaded assets and attached files'
            )}
          </p>
        </div>

        {/* Filter segment tabs */}
        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => handleSourceChange('all')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              source === 'all'
                ? 'bg-secondary text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t('media_library.filter.all', 'All')}
          </button>
          <button
            type="button"
            onClick={() => handleSourceChange('curator')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              source === 'curator'
                ? 'bg-secondary text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t('media_library.filter.curator', 'Curator')}
          </button>
          <button
            type="button"
            onClick={() => handleSourceChange('spatie')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              source === 'spatie'
                ? 'bg-secondary text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t('media_library.filter.attached', 'Attached')}
          </button>
        </div>
      </div>

      {/* Grid Content */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="flex items-center gap-2 text-slate-500">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-sm">{t('common.loading', 'Loading media files...')}</span>
            </div>
          </div>
        ) : isError ? (
          <div className="flex h-64 flex-col items-center justify-center text-center">
            <p className="text-sm text-red-600">{t('common.error_occurred', 'Failed to load media files.')}</p>
            <Button
              variant="secondary"
              className="mt-3"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['media-library'] })}
            >
              {t('common.retry', 'Retry')}
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-600">{t('media_library.empty', 'No media files found.')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {items.map((item) => {
              const displayUrl = item.thumbnail_url || item.url;
              return (
                <div
                  key={`${item.source}-${item.id}`}
                  className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-all hover:border-slate-300 hover:shadow-sm"
                >
                  {/* Aspect-square media container */}
                  <div className="relative aspect-square w-full overflow-hidden bg-slate-100">
                    <img
                      src={displayUrl}
                      alt={item.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                      onError={(e) => {
                        // Fallback placeholder on broken image
                        (e.target as HTMLImageElement).src =
                          'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="1.5"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
                      }}
                    />

                    {/* Source / Model Badge */}
                    <div className="absolute left-2 top-2 max-w-[80%]">
                      {item.source === 'curator' ? (
                        <span className="inline-flex items-center rounded-md bg-slate-900/75 px-1.5 py-0.5 text-[10px] font-medium text-white shadow-xs backdrop-blur-xs">
                          {item.folder || 'general'}
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center truncate rounded-md bg-secondary/90 px-1.5 py-0.5 text-[10px] font-medium text-white shadow-xs backdrop-blur-xs"
                          title={t('media_library.attached_to', {
                            model: item.model_type || 'Record',
                            defaultValue: `Attached to ${item.model_type || 'Record'}`,
                          })}
                        >
                          {t('media_library.attached_to', {
                            model: item.model_type || 'Record',
                            defaultValue: `Attached to ${item.model_type || 'Record'}`,
                          })}
                        </span>
                      )}
                    </div>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => setDeletingItem(item)}
                      aria-label={t('common.delete', 'Delete')}
                      className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-slate-500 shadow-xs backdrop-blur-xs transition-opacity hover:bg-white hover:text-red-600 focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Caption */}
                  <div className="flex flex-col p-2">
                    <span
                      className="truncate text-xs font-medium text-slate-800"
                      title={item.name}
                    >
                      {item.name}
                    </span>
                    <span className="mt-0.5 text-[10px] text-slate-400">
                      {formatFileSize(item.size)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {meta && totalPages > 1 && (
          <div className="mt-6 flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-4 sm:flex-row">
            <div className="text-xs text-slate-500">
              {t('media_library.page_info', {
                current: currentPage,
                total: totalPages,
                defaultValue: `Page ${currentPage} of ${totalPages}`,
              })}{' '}
              <span className="text-slate-400">
                {t('media_library.total_items', {
                  count: meta.total,
                  defaultValue: `(${meta.total} items)`,
                })}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage <= 1 || isLoading}
              >
                {t('common.previous', 'Previous')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage >= totalPages || isLoading}
              >
                {t('common.next', 'Next')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        open={deletingItem !== null}
        title={t('media_library.delete_confirm_title', 'Delete Media File')}
        message={t(
          'media_library.delete_confirm_message',
          'Are you sure you want to delete {{name}}? This action cannot be undone.',
          { name: deletingItem?.name || '' }
        )}
        isLoading={deleteMutation.isPending}
        onConfirm={() =>
          deletingItem &&
          deleteMutation.mutate({
            itemSource: deletingItem.source,
            id: deletingItem.id,
          })
        }
        onClose={() => setDeletingItem(null)}
      />
    </div>
  );
}
