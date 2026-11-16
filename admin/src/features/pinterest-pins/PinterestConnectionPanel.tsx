import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  PinterestPublishSettings,
  disconnectPinterest,
  fetchPinterestConnection,
  pinterestConnectionKey,
  startPinterestConnect,
  updatePinterestSettings,
} from './api';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Who Pinterest is connected as, the connect/disconnect buttons, and the switches for automatic posting. */
export function PinterestConnectionPanel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const [draft, setDraft] = useState<PinterestPublishSettings | null>(null);

  const connectionQuery = useQuery({ queryKey: pinterestConnectionKey, queryFn: fetchPinterestConnection });
  const connection = connectionQuery.data;

  // The form follows what the server has, until the owner starts changing it.
  useEffect(() => {
    if (connection) setDraft(connection.settings);
  }, [connection]);

  const connectMutation = useMutation({
    mutationFn: startPinterestConnect,
    onSuccess: (url) => window.location.assign(url),
    onError: (error: Error) => toast.error(error.message || t('common.error_occurred')),
  });

  const disconnectMutation = useMutation({
    mutationFn: disconnectPinterest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pinterestConnectionKey });
      toast.success(t('pinterest_connect.disconnected_success'));
      setConfirmingDisconnect(false);
    },
    onError: (error: Error) => toast.error(error.message || t('common.error_occurred')),
  });

  const settingsMutation = useMutation({
    mutationFn: (settings: PinterestPublishSettings) => updatePinterestSettings(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pinterestConnectionKey });
      toast.success(t('pinterest_connect.settings_saved'));
    },
    onError: (error: Error & { data?: { errors?: Record<string, string[]> } }) => {
      const first = error.data?.errors ? Object.values(error.data.errors)[0]?.[0] : undefined;
      toast.error(first || error.message || t('common.error_occurred'));
    },
  });

  if (connectionQuery.isError) {
    return <p className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{t('pinterest_connect.load_error')}</p>;
  }

  if (!connection) return null;

  const lost = connection.status === 'disconnected';

  return (
    <section className="mb-6 space-y-3" aria-label={t('pinterest_connect.title')}>
      {lost && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-red-800">{t('pinterest_connect.lost_banner')}</p>
            {connection.last_error && <p className="mt-1 text-xs text-red-700">{connection.last_error}</p>}
          </div>
          <Button variant="primary" disabled={connectMutation.isPending} onClick={() => connectMutation.mutate()}>
            {t('pinterest_connect.reconnect')}
          </Button>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{t('pinterest_connect.title')}</h2>
            {!connection.configured ? (
              <p className="mt-1 text-sm text-slate-500">{t('pinterest_connect.not_configured')}</p>
            ) : connection.connected ? (
              <p className="mt-1 text-sm text-slate-600">
                {t('pinterest_connect.connected_as', { username: connection.username ?? '—' })}
                {connection.refresh_expires_at && (
                  <span className="ml-2 text-xs text-slate-400">{t('pinterest_connect.login_valid_until', { date: formatDate(connection.refresh_expires_at) })}</span>
                )}
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-500">{t('pinterest_connect.not_connected')}</p>
            )}
          </div>

          {connection.configured && connection.connected && !confirmingDisconnect && (
            <Button variant="secondary" onClick={() => setConfirmingDisconnect(true)}>{t('pinterest_connect.disconnect')}</Button>
          )}
          {connection.configured && !connection.connected && !lost && (
            <Button variant="primary" disabled={connectMutation.isPending} onClick={() => connectMutation.mutate()}>
              {t(connectMutation.isPending ? 'pinterest_connect.connecting' : 'pinterest_connect.connect')}
            </Button>
          )}
        </div>

        {confirmingDisconnect && (
          <div className="mt-3 flex flex-col gap-3 rounded-lg bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-700">{t('pinterest_connect.disconnect_confirm')}</p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setConfirmingDisconnect(false)} disabled={disconnectMutation.isPending}>{t('pinterest_pins.cancel')}</Button>
              <Button variant="primary" onClick={() => disconnectMutation.mutate()} disabled={disconnectMutation.isPending}>{t('pinterest_connect.disconnect_yes')}</Button>
            </div>
          </div>
        )}

        {connection.connected && draft && (
          <form
            className="mt-4 border-t border-slate-100 pt-4"
            onSubmit={(event) => {
              event.preventDefault();
              settingsMutation.mutate(draft);
            }}
          >
            <h3 className="text-sm font-semibold text-slate-900">{t('pinterest_connect.settings_title')}</h3>
            <label className="mt-2 flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
                checked={draft.auto_publish}
                onChange={(event) => setDraft({ ...draft, auto_publish: event.target.checked })}
              />
              <span>
                {t('pinterest_connect.auto_publish')}
                <span className="block text-xs text-slate-500">{t('pinterest_connect.auto_publish_hint')}</span>
              </span>
            </label>

            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              <div>
                <label htmlFor="pin-max-per-day" className="mb-1 block text-xs font-medium text-slate-500">{t('pinterest_connect.max_per_day')}</label>
                <Input id="pin-max-per-day" type="number" min={1} max={10} value={draft.max_per_day} onChange={(event) => setDraft({ ...draft, max_per_day: Number(event.target.value) })} />
              </div>
              <div>
                <label htmlFor="pin-min-gap" className="mb-1 block text-xs font-medium text-slate-500">{t('pinterest_connect.min_gap')}</label>
                <Input id="pin-min-gap" type="number" min={30} max={1440} step={15} value={draft.min_gap_minutes} onChange={(event) => setDraft({ ...draft, min_gap_minutes: Number(event.target.value) })} />
              </div>
              <div>
                <label htmlFor="pin-window-start" className="mb-1 block text-xs font-medium text-slate-500">{t('pinterest_connect.window_start')}</label>
                <Input id="pin-window-start" type="time" value={draft.window_start} onChange={(event) => setDraft({ ...draft, window_start: event.target.value })} />
              </div>
              <div>
                <label htmlFor="pin-window-end" className="mb-1 block text-xs font-medium text-slate-500">{t('pinterest_connect.window_end')}</label>
                <Input id="pin-window-end" type="time" value={draft.window_end} onChange={(event) => setDraft({ ...draft, window_end: event.target.value })} />
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">{t('pinterest_connect.timezone_note', { timezone: draft.timezone })}</p>

            <div className="mt-3">
              <Button type="submit" variant="primary" disabled={settingsMutation.isPending}>{t('pinterest_connect.save_settings')}</Button>
            </div>
          </form>
        )}

        {connection.recent_errors.length > 0 && (
          <details className="mt-4 border-t border-slate-100 pt-3">
            <summary className="cursor-pointer text-sm font-medium text-slate-700">{t('pinterest_connect.recent_errors')}</summary>
            <ul className="mt-2 space-y-1 text-xs text-slate-600">
              {connection.recent_errors.map((entry) => (
                <li key={entry.id}>
                  <span className="font-mono text-slate-500">{entry.endpoint}</span>
                  {entry.http_status ? ` · ${entry.http_status}` : ''}
                  {entry.message ? ` · ${entry.message}` : ''}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </section>
  );
}
