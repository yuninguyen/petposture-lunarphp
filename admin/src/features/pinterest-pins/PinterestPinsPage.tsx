import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DeleteConfirmModal } from '@/components/ui/delete-confirm-modal';
import { PlusIcon } from '@/components/ui/icons';
import { PinFilters, PinterestPin, deletePin, fetchPinOptions, fetchPins, pinterestPinOptionsKey, pinterestPinsKey } from './api';
import { PinterestPinModal } from './PinterestPinModal';
import { PinterestPinRowActions } from './PinterestPinRowActions';
import type { PinStatus } from './pinSchema';

const selectClass =
  'appearance-none h-[38px] w-full rounded-lg border border-slate-200 bg-white px-3 pr-8 text-sm text-slate-700 shadow-sm outline-none transition-colors hover:bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/20';

function formatPostedAt(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function PinterestPinsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<PinFilters>({ status: '', postId: '', page: 1 });
  const [editing, setEditing] = useState<{ pin: PinterestPin | null } | null>(null);
  const [deleting, setDeleting] = useState<PinterestPin | null>(null);

  const pinsQuery = useQuery({
    queryKey: [...pinterestPinsKey, 'list', filters],
    queryFn: () => fetchPins(filters),
    placeholderData: keepPreviousData,
  });
  const optionsQuery = useQuery({ queryKey: pinterestPinOptionsKey, queryFn: fetchPinOptions });

  const deleteMutation = useMutation({
    mutationFn: (pin: PinterestPin) => deletePin(pin.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pinterestPinsKey });
      toast.success(t('pinterest_pins.delete_success'));
      setDeleting(null);
    },
    onError: (error: Error) => toast.error(error.message || t('common.error_occurred')),
  });

  const pins = pinsQuery.data?.data ?? [];
  const meta = pinsQuery.data?.meta;
  const posts = optionsQuery.data?.posts ?? [];
  const filtered = filters.status !== '' || filters.postId !== '';

  // A new filter starts again from the first page: the old page number may not exist any more.
  function changeFilter(next: Partial<PinFilters>) {
    setFilters((current) => ({ ...current, ...next, page: 1 }));
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('pinterest_pins.title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('pinterest_pins.subtitle')}</p>
        </div>
        <Button variant="primary" className="flex items-center gap-2" onClick={() => setEditing({ pin: null })}>
          <PlusIcon className="h-4 w-4" />
          {t('pinterest_pins.create')}
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-t-xl border border-b-0 border-slate-200 bg-white p-4">
        <div className="w-full sm:w-48">
          <label htmlFor="pin-filter-status" className="mb-1 block text-xs font-medium text-slate-500">{t('pinterest_pins.col_status')}</label>
          <select
            id="pin-filter-status"
            className={selectClass}
            value={filters.status}
            onChange={(event) => changeFilter({ status: event.target.value as '' | PinStatus })}
          >
            <option value="">{t('pinterest_pins.filter_status_all')}</option>
            <option value="ready">{t('pinterest_pins.status_ready')}</option>
            <option value="posted">{t('pinterest_pins.status_posted')}</option>
          </select>
        </div>
        <div className="w-full sm:w-72">
          <label htmlFor="pin-filter-post" className="mb-1 block text-xs font-medium text-slate-500">{t('pinterest_pins.col_post')}</label>
          <select
            id="pin-filter-post"
            className={selectClass}
            value={filters.postId === '' ? '' : String(filters.postId)}
            onChange={(event) => changeFilter({ postId: event.target.value === '' ? '' : Number(event.target.value) })}
          >
            <option value="">{t('pinterest_pins.filter_post_all')}</option>
            {posts.map((post) => (
              <option key={post.id} value={String(post.id)}>{post.title}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-b-xl border border-slate-200 bg-white">
        {pinsQuery.isError ? (
          <p className="p-8 text-center text-sm text-red-600">{t('pinterest_pins.load_error')}</p>
        ) : pinsQuery.isPending ? (
          <p className="p-8 text-center text-sm text-slate-500">{t('pinterest_pins.loading')}</p>
        ) : pins.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-slate-700">{t(filtered ? 'pinterest_pins.empty_filtered' : 'pinterest_pins.empty_title')}</p>
            {!filtered && <p className="mt-1 text-sm text-slate-500">{t('pinterest_pins.empty_hint')}</p>}
          </div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3">{t('pinterest_pins.col_image')}</th>
                <th scope="col" className="px-4 py-3">{t('pinterest_pins.col_pin')}</th>
                <th scope="col" className="px-4 py-3">{t('pinterest_pins.col_post')}</th>
                <th scope="col" className="px-4 py-3">{t('pinterest_pins.col_board')}</th>
                <th scope="col" className="px-4 py-3">{t('pinterest_pins.col_status')}</th>
                <th scope="col" className="px-4 py-3">{t('pinterest_pins.col_scheduled')}</th>
                <th scope="col" className="px-4 py-3 text-right">{t('pinterest_pins.col_actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pins.map((pin) => (
                <tr key={pin.id} className="align-top">
                  <td className="px-4 py-3">
                    <div className="aspect-[2/3] w-14 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                      <img src={pin.image_url} alt={pin.title} loading="lazy" className="h-full w-full object-cover" />
                    </div>
                  </td>
                  <td className="max-w-xs px-4 py-3">
                    <p className="font-medium text-slate-900">{pin.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{pin.description}</p>
                  </td>
                  <td className="max-w-[14rem] px-4 py-3 text-slate-600">{pin.post ? pin.post.title : t('pinterest_pins.no_post')}</td>
                  <td className="px-4 py-3 text-slate-600">{pin.board ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge color={pin.status === 'posted' ? 'emerald' : 'blue'}>
                      {t(pin.status === 'posted' ? 'pinterest_pins.status_posted' : 'pinterest_pins.status_ready')}
                    </Badge>
                    {pin.posted_at && (
                      <p className="mt-1 text-xs text-slate-500">{t('pinterest_pins.posted_on', { date: formatPostedAt(pin.posted_at) })}</p>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{pin.scheduled_date ?? '—'}</td>
                  <td className="px-4 py-3">
                    <PinterestPinRowActions pin={pin} onEdit={(target) => setEditing({ pin: target })} onDelete={setDeleting} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {meta && meta.last_page > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <Button variant="secondary" disabled={meta.current_page <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>
            {t('pinterest_pins.previous')}
          </Button>
          <span className="text-sm text-slate-600">{t('pinterest_pins.page_info', { page: meta.current_page, pages: meta.last_page })}</span>
          <Button variant="secondary" disabled={meta.current_page >= meta.last_page} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>
            {t('pinterest_pins.next')}
          </Button>
        </div>
      )}

      <PinterestPinModal open={editing !== null} pin={editing?.pin ?? null} onClose={() => setEditing(null)} />

      <DeleteConfirmModal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting)}
        title={t('pinterest_pins.delete_title')}
        message={t('pinterest_pins.delete_message')}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
