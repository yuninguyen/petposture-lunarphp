import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { TrashIcon } from '@/components/ui/icons';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import {
  PinterestCredentials,
  PinterestCredentialsInput,
  PinterestPublishSettings,
  createPinterestBoard,
  deletePinterestBoard,
  disconnectPinterest,
  fetchPinterestBoards,
  fetchPinterestConnection,
  pinterestBoardsKey,
  pinterestConnectionKey,
  startPinterestConnect,
  updatePinterestCredentials,
  updatePinterestSettings,
} from './api';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** The address Pinterest sends the owner back to: this admin's own callback page. */
function defaultRedirectUri(): string {
  return `${window.location.origin}/system/integrations/pinterest/callback`;
}

/** A new account (or the sandbox) has no boards, and a pin needs one: this makes one without leaving the admin. */
function CreateBoardForm() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');

  const createMutation = useMutation({
    mutationFn: () => createPinterestBoard(name.trim()),
    onSuccess: (board) => {
      queryClient.invalidateQueries({ queryKey: pinterestBoardsKey });
      toast.success(t('pinterest_connect.board_created', { name: board.name }));
      setName('');
    },
    onError: (error: Error & { data?: { errors?: Record<string, string[]> } }) => {
      const first = error.data?.errors ? Object.values(error.data.errors)[0]?.[0] : undefined;
      toast.error(first || error.message || t('common.error_occurred'));
    },
  });

  return (
    <form
      className="mt-4 border-t border-slate-100 pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim() !== '') createMutation.mutate();
      }}
    >
      <h3 className="text-sm font-semibold text-slate-900">{t('pinterest_connect.board_title')}</h3>
      <p className="mt-1 text-xs text-slate-500">{t('pinterest_connect.board_hint')}</p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="w-full sm:w-72">
          <label htmlFor="pin-new-board" className="mb-1 block text-xs font-medium text-slate-500">{t('pinterest_connect.board_name')}</label>
          <Input id="pin-new-board" maxLength={50} value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <Button type="submit" variant="secondary" disabled={createMutation.isPending || name.trim() === ''}>{t('pinterest_connect.board_create')}</Button>
      </div>
    </form>
  );
}

/**
 * The boards of the connected account, each with a delete button. Deleting a board also deletes every pin on it on
 * Pinterest, so it asks first and names the board.
 */
function BoardList() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<string | null>(null);

  const boardsQuery = useQuery({ queryKey: pinterestBoardsKey, queryFn: fetchPinterestBoards });
  const boards = boardsQuery.data ?? [];

  const deleteMutation = useMutation({
    mutationFn: (board: { id: string; name: string }) => deletePinterestBoard(board.id).then(() => board),
    onSuccess: (board) => {
      queryClient.invalidateQueries({ queryKey: pinterestBoardsKey });
      queryClient.invalidateQueries({ queryKey: ['pinterest-pins'] });
      toast.success(t('pinterest_connect.board_deleted', { name: board.name }));
      setConfirming(null);
    },
    onError: (error: Error) => toast.error(error.message || t('common.error_occurred')),
  });

  if (boards.length === 0) return null;

  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-slate-500">{t('pinterest_connect.boards_list_title')}</p>
      <ul className="mt-1 divide-y divide-slate-100 rounded-lg border border-slate-100">
        {boards.map((board) => (
          <li key={board.id} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-slate-800">{board.name}</span>
            {confirming === board.id ? (
              <span className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <span className="text-xs text-red-700">{t('pinterest_connect.board_delete_confirm', { name: board.name })}</span>
                <span className="flex gap-2">
                  <Button variant="secondary" onClick={() => setConfirming(null)} disabled={deleteMutation.isPending}>{t('pinterest_pins.cancel')}</Button>
                  <Button variant="primary" onClick={() => deleteMutation.mutate(board)} disabled={deleteMutation.isPending}>{t('pinterest_connect.board_delete_yes')}</Button>
                </span>
              </span>
            ) : (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center self-start rounded-md text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 sm:self-auto"
                title={t('pinterest_connect.board_delete', { name: board.name })}
                aria-label={t('pinterest_connect.board_delete', { name: board.name })}
                onClick={() => setConfirming(board.id)}
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The Pinterest app's details, kept on the server. The secret can be replaced but never shown: the field stays empty
 * and a blank one keeps the saved secret.
 */
function CredentialsForm({ credentials, connected, startOpen }: { credentials: PinterestCredentials; connected: boolean; startOpen: boolean }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<PinterestCredentialsInput>({
    app_id: credentials.app_id ?? '',
    app_secret: '',
    redirect_uri: credentials.redirect_uri ?? defaultRedirectUri(),
    sandbox: credentials.sandbox,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof PinterestCredentialsInput, string>>>({});

  const saveMutation = useMutation({
    mutationFn: () => updatePinterestCredentials(values),
    onSuccess: () => {
      setErrors({});
      setValues((current) => ({ ...current, app_secret: '' }));
      queryClient.invalidateQueries({ queryKey: pinterestConnectionKey });
      toast.success(t('pinterest_connect.credentials_saved'));
    },
    onError: (error: Error & { status?: number; data?: { errors?: Record<string, string[]> } }) => {
      if (error.status === 422 && error.data?.errors) {
        const next: Partial<Record<keyof PinterestCredentialsInput, string>> = {};
        for (const [field, messages] of Object.entries(error.data.errors)) {
          if (messages[0]) next[field as keyof PinterestCredentialsInput] = messages[0];
        }
        setErrors(next);
        return;
      }
      toast.error(error.message || t('common.error_occurred'));
    },
  });

  return (
    <details className="mt-4 border-t border-slate-100 pt-3" open={startOpen}>
      <summary className="cursor-pointer text-sm font-medium text-slate-700">{t('pinterest_connect.credentials_title')}</summary>
      <form
        className="mt-3 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          saveMutation.mutate();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="pin-app-id" className="mb-1 block text-xs font-medium text-slate-500">{t('pinterest_connect.app_id')}</label>
            <Input id="pin-app-id" inputMode="numeric" autoComplete="off" value={values.app_id} onChange={(event) => setValues({ ...values, app_id: event.target.value })} />
            {errors.app_id && <p className="mt-1 text-xs text-red-600">{errors.app_id}</p>}
          </div>
          <div>
            <label htmlFor="pin-app-secret" className="mb-1 block text-xs font-medium text-slate-500">{t('pinterest_connect.app_secret')}</label>
            <PasswordInput
              id="pin-app-secret"
              autoComplete="new-password"
              placeholder={credentials.has_secret ? t('pinterest_connect.app_secret_set') : ''}
              value={values.app_secret}
              onChange={(event) => setValues({ ...values, app_secret: event.target.value })}
            />
            {errors.app_secret ? (
              <p className="mt-1 text-xs text-red-600">{errors.app_secret}</p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">{t(credentials.has_secret ? 'pinterest_connect.app_secret_keep_hint' : 'pinterest_connect.app_secret_hint')}</p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="pin-redirect-uri" className="mb-1 block text-xs font-medium text-slate-500">{t('pinterest_connect.redirect_uri')}</label>
          <Input id="pin-redirect-uri" inputMode="url" value={values.redirect_uri} onChange={(event) => setValues({ ...values, redirect_uri: event.target.value })} />
          {errors.redirect_uri ? <p className="mt-1 text-xs text-red-600">{errors.redirect_uri}</p> : <p className="mt-1 text-xs text-slate-500">{t('pinterest_connect.redirect_uri_hint')}</p>}
        </div>

        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-slate-300"
            checked={values.sandbox}
            onChange={(event) => setValues({ ...values, sandbox: event.target.checked })}
          />
          <span>
            {t('pinterest_connect.sandbox')}
            <span className="block text-xs text-slate-500">{t('pinterest_connect.sandbox_hint')}</span>
          </span>
        </label>

        {connected && <p className="text-xs text-amber-700">{t('pinterest_connect.credentials_connected_note')}</p>}

        <Button type="submit" variant="primary" disabled={saveMutation.isPending}>{t('pinterest_connect.save_credentials')}</Button>
      </form>
    </details>
  );
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

        {connection.connected && (
          <>
            <CreateBoardForm />
            <BoardList />
          </>
        )}

        <CredentialsForm
          key={`${connection.credentials.app_id}-${connection.credentials.sandbox}-${connection.credentials.has_secret}`}
          credentials={connection.credentials}
          connected={connection.connected}
          startOpen={!connection.configured}
        />

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
