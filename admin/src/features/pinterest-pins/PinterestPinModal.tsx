import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ImageIcon } from '@/components/ui/icons';
import { MediaLibraryModal } from '@/components/ui/media-library-modal';
import {
  PinterestPin,
  createPin,
  fetchPinOptions,
  fetchPinterestBoards,
  fetchPinterestConnection,
  pinterestBoardsKey,
  pinterestConnectionKey,
  pinterestPinOptionsKey,
  pinterestPinsKey,
  updatePin,
} from './api';
import {
  PIN_DESCRIPTION_MAX,
  PIN_TITLE_MAX,
  PinFormValues,
  buildPinPayload,
  charCount,
  isTwoByThree,
  pinFormSchema,
} from './pinSchema';

interface PinterestPinModalProps {
  open: boolean;
  pin: PinterestPin | null;
  onClose: () => void;
}

interface ApiError extends Error {
  status?: number;
  data?: { errors?: Record<string, string[]> };
}

const emptyValues: PinFormValues = {
  mediaId: '',
  postId: '',
  title: '',
  description: '',
  destinationUrl: '',
  board: '',
  boardId: '',
  status: 'ready',
  scheduledDate: '',
};

// The server names fields in snake_case; the form uses camelCase.
const SERVER_FIELD: Record<string, keyof PinFormValues> = {
  media_id: 'mediaId',
  post_id: 'postId',
  destination_url: 'destinationUrl',
  scheduled_date: 'scheduledDate',
  title: 'title',
  description: 'description',
  board: 'board',
  pinterest_board_id: 'boardId',
  status: 'status',
};

function valuesFor(pin: PinterestPin | null): PinFormValues {
  if (!pin) return emptyValues;

  return {
    mediaId: pin.media_id ?? '',
    postId: pin.post_id ? String(pin.post_id) : '',
    title: pin.title,
    description: pin.description,
    destinationUrl: pin.destination_url,
    board: pin.board ?? '',
    boardId: pin.pinterest_board_id ?? '',
    // The form only offers ready and posted; a pin the posting job is holding shows as ready.
    status: pin.status === 'posted' ? 'posted' : 'ready',
    scheduledDate: pin.scheduled_date ?? '',
  };
}

/** True when the posting job holds the pin, so saving its content must not change its status. */
function heldByJob(pin: PinterestPin | null): boolean {
  return pin !== null && pin.status !== 'ready' && pin.status !== 'posted';
}

function Field({ id, label, error, children, hint }: { id: string; label: string; error?: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function Counter({ used, max }: { used: number; max: number }) {
  const { t } = useTranslation();

  return (
    <span aria-live="polite" className={`text-xs ${used > max ? 'font-semibold text-red-600' : 'text-slate-400'}`}>
      {t('pinterest_pins.char_count', { used, max })}
    </span>
  );
}

const selectClass =
  'w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-sm text-ink focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary-light';

export function PinterestPinModal({ open, pin, onClose }: PinterestPinModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isEditing = pin !== null;
  const [values, setValues] = useState<PinFormValues>(emptyValues);
  const [errors, setErrors] = useState<Partial<Record<keyof PinFormValues, string>>>({});
  const [imageUrl, setImageUrl] = useState('');
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const optionsQuery = useQuery({ queryKey: pinterestPinOptionsKey, queryFn: fetchPinOptions, enabled: open });
  const posts = optionsQuery.data?.posts ?? [];
  const boards = optionsQuery.data?.boards ?? [];

  // Once Pinterest is connected the board is chosen from the account's own boards, so it can be posted automatically.
  const connectionQuery = useQuery({ queryKey: pinterestConnectionKey, queryFn: fetchPinterestConnection, enabled: open });
  const connected = connectionQuery.data?.connected === true;
  const pinterestBoardsQuery = useQuery({ queryKey: pinterestBoardsKey, queryFn: fetchPinterestBoards, enabled: open && connected });
  const pinterestBoards = pinterestBoardsQuery.data ?? [];
  const useBoardList = connected && pinterestBoardsQuery.isSuccess;

  useEffect(() => {
    if (!open) return;
    setValues(valuesFor(pin));
    setErrors({});
    // An image whose library entry was deleted has no file left to show.
    setImageUrl(pin && pin.media_id ? pin.image_url : '');
    setImageSize(pin && pin.image_width && pin.image_height ? { width: pin.image_width, height: pin.image_height } : null);
    setPickerOpen(false);
  }, [open, pin]);

  const saveMutation = useMutation({
    mutationFn: (formValues: PinFormValues) => {
      // Editing a pin the job holds keeps its status unless the person picked "posted".
      const omitStatus = heldByJob(pin) && formValues.status === 'ready';

      return pin ? updatePin(pin.id, buildPinPayload(formValues, omitStatus)) : createPin(buildPinPayload(formValues));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pinterestPinsKey });
      toast.success(t(isEditing ? 'pinterest_pins.update_success' : 'pinterest_pins.create_success'));
      onClose();
    },
    onError: (error: ApiError) => {
      if (error.status === 422 && error.data?.errors) {
        const next: Partial<Record<keyof PinFormValues, string>> = {};
        for (const [serverField, messages] of Object.entries(error.data.errors)) {
          const field = SERVER_FIELD[serverField];
          if (field && messages[0]) next[field] = messages[0];
        }
        setErrors(next);
        return;
      }
      toast.error(error.message || t('common.error_occurred'));
    },
  });

  function setField<K extends keyof PinFormValues>(key: K, value: PinFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function choosePost(postId: string) {
    setValues((current) => {
      const post = posts.find((candidate) => String(candidate.id) === postId);
      // Choosing a post fills the link with that post's URL; clearing the post leaves the link as it is.
      return { ...current, postId, destinationUrl: post ? post.url : current.destinationUrl };
    });
    setErrors((current) => ({ ...current, postId: undefined, destinationUrl: undefined }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = pinFormSchema.safeParse(values);

    if (!result.success) {
      const next: Partial<Record<keyof PinFormValues, string>> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof PinFormValues;
        if (!next[key]) next[key] = t(issue.message);
      }
      setErrors(next);
      return;
    }

    setErrors({});
    saveMutation.mutate(values);
  }

  if (!open) return null;

  const titleUsed = charCount(values.title.trim());
  const descriptionUsed = charCount(values.description.trim());
  const imageMissing = isEditing && !pin?.media_id && !values.mediaId;
  const hasCurrentPostOption = values.postId !== '' && !posts.some((post) => String(post.id) === values.postId);

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={() => !saveMutation.isPending && onClose()}>
      <form
        noValidate
        onSubmit={handleSubmit}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pin-modal-title"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
      >
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 id="pin-modal-title" className="text-lg font-semibold text-slate-900">
            {t(isEditing ? 'pinterest_pins.form_edit_title' : 'pinterest_pins.form_create_title')}
          </h2>
        </div>

        <div className="grid flex-1 gap-6 overflow-y-auto px-6 py-5 md:grid-cols-[220px_1fr]">
          <div>
            <p className="mb-1 text-sm font-medium text-slate-700">{t('pinterest_pins.field_image')}</p>
            <div
              data-testid="pin-image-frame"
              className="aspect-[2/3] w-full overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50"
            >
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt=""
                  className="h-full w-full object-contain"
                  onLoad={(event) => {
                    const { naturalWidth, naturalHeight } = event.currentTarget;
                    setImageSize(naturalWidth && naturalHeight ? { width: naturalWidth, height: naturalHeight } : null);
                  }}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 p-3 text-center text-xs text-slate-400">
                  <ImageIcon className="h-8 w-8" />
                  <span>2:3</span>
                </div>
              )}
            </div>
            <Button type="button" variant="secondary" className="mt-2 w-full" onClick={() => setPickerOpen(true)}>
              {t(imageUrl ? 'pinterest_pins.image_change' : 'pinterest_pins.image_choose')}
            </Button>
            <p className="mt-2 text-xs text-slate-500">{t('pinterest_pins.image_hint')}</p>
            {imageUrl && imageSize && !isTwoByThree(imageSize.width, imageSize.height) && (
              <p className="mt-2 text-xs text-amber-700">{t('pinterest_pins.image_not_two_by_three')}</p>
            )}
            {imageMissing && <p className="mt-2 text-xs text-amber-700">{t('pinterest_pins.image_missing')}</p>}
            {errors.mediaId && <p className="mt-2 text-xs text-red-600">{errors.mediaId}</p>}
          </div>

          <div className="space-y-4">
            <Field id="pin-post" label={t('pinterest_pins.field_post')} error={errors.postId}>
              <select id="pin-post" className={selectClass} value={values.postId} onChange={(event) => choosePost(event.target.value)}>
                <option value="">{t('pinterest_pins.field_post_none')}</option>
                {hasCurrentPostOption && pin?.post && <option value={String(pin.post.id)}>{pin.post.title}</option>}
                {posts.map((post) => (
                  <option key={post.id} value={String(post.id)}>{post.title}</option>
                ))}
              </select>
            </Field>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label htmlFor="pin-title" className="block text-sm font-medium text-slate-700">{t('pinterest_pins.field_title')}</label>
                <Counter used={titleUsed} max={PIN_TITLE_MAX} />
              </div>
              <Input id="pin-title" value={values.title} onChange={(event) => setField('title', event.target.value)} />
              {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title}</p>}
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label htmlFor="pin-description" className="block text-sm font-medium text-slate-700">{t('pinterest_pins.field_description')}</label>
                <Counter used={descriptionUsed} max={PIN_DESCRIPTION_MAX} />
              </div>
              <Textarea id="pin-description" rows={5} value={values.description} onChange={(event) => setField('description', event.target.value)} />
              {errors.description && <p className="mt-1 text-xs text-red-600">{errors.description}</p>}
            </div>

            <Field id="pin-url" label={t('pinterest_pins.field_url')} error={errors.destinationUrl} hint={t('pinterest_pins.field_url_hint')}>
              <Input id="pin-url" inputMode="url" value={values.destinationUrl} onChange={(event) => setField('destinationUrl', event.target.value)} />
            </Field>

            {useBoardList ? (
              <Field id="pin-board" label={t('pinterest_pins.field_board')} error={errors.boardId ?? errors.board} hint={t('pinterest_pins.field_board_hint_connected')}>
                <select
                  id="pin-board"
                  className={selectClass}
                  value={values.boardId}
                  onChange={(event) => {
                    const chosen = pinterestBoards.find((board) => board.id === event.target.value);
                    setValues((current) => ({ ...current, boardId: chosen?.id ?? '', board: chosen?.name ?? '' }));
                    setErrors((current) => ({ ...current, board: undefined, boardId: undefined }));
                  }}
                >
                  <option value="">{t('pinterest_pins.field_board_choose')}</option>
                  {values.boardId !== '' && !pinterestBoards.some((board) => board.id === values.boardId) && (
                    <option value={values.boardId}>{values.board || values.boardId}</option>
                  )}
                  {pinterestBoards.map((board) => (
                    <option key={board.id} value={board.id}>{board.name}</option>
                  ))}
                </select>
              </Field>
            ) : (
              <Field id="pin-board" label={t('pinterest_pins.field_board')} error={errors.board}>
                <Input
                  id="pin-board"
                  list="pin-board-suggestions"
                  placeholder={t('pinterest_pins.field_board_placeholder')}
                  value={values.board}
                  onChange={(event) => setField('board', event.target.value)}
                />
                <datalist id="pin-board-suggestions">
                  {boards.map((board) => (
                    <option key={board} value={board} />
                  ))}
                </datalist>
              </Field>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="pin-scheduled" label={t('pinterest_pins.field_scheduled')} error={errors.scheduledDate}>
                <Input id="pin-scheduled" type="date" value={values.scheduledDate} onChange={(event) => setField('scheduledDate', event.target.value)} />
              </Field>
              <Field id="pin-status" label={t('pinterest_pins.field_status')} error={errors.status}>
                <select id="pin-status" className={selectClass} value={values.status} onChange={(event) => setField('status', event.target.value as PinFormValues['status'])}>
                  <option value="ready">{t('pinterest_pins.status_ready')}</option>
                  <option value="posted">{t('pinterest_pins.status_posted')}</option>
                </select>
              </Field>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saveMutation.isPending}>
            {t('pinterest_pins.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={saveMutation.isPending}>
            {t(saveMutation.isPending ? 'pinterest_pins.saving' : 'pinterest_pins.save')}
          </Button>
        </div>
      </form>
    </div>

    {/* Beside the overlay, not inside it: a click in the library must not reach the form's overlay and close it. */}
    <MediaLibraryModal
      open={pickerOpen}
      onClose={() => setPickerOpen(false)}
      onSelect={(media) => {
        setField('mediaId', media.id);
        setImageUrl(media.url);
        setImageSize(null);
        setPickerOpen(false);
      }}
    />
    </>
  );
}
