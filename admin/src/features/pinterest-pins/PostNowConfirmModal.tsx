import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

/** Asks before a pin is posted to Pinterest straight away. A neutral confirm: the shared one is made for deleting. */
export function PostNowConfirmModal({
  open,
  pinTitle,
  onClose,
  onConfirm,
  isLoading = false,
}: {
  open: boolean;
  pinTitle: string;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}) {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4" onClick={() => !isLoading && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-now-title"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-900/5 sm:p-8"
      >
        <h2 id="post-now-title" className="text-xl font-bold text-slate-900">{t('pinterest_pins.post_now_title')}</h2>
        <p className="mt-2 text-sm font-medium text-slate-700">{pinTitle}</p>
        <p className="mt-2 text-sm text-slate-500">{t('pinterest_pins.post_now_message')}</p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>{t('pinterest_pins.cancel')}</Button>
          <Button variant="primary" onClick={onConfirm} disabled={isLoading}>
            {t(isLoading ? 'pinterest_pins.post_now_posting' : 'pinterest_pins.post_now_confirm')}
          </Button>
        </div>
      </div>
    </div>
  );
}
