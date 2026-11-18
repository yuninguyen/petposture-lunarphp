import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

/**
 * An in-page confirmation, used instead of window.confirm so it shows in every browser, can be styled,
 * and can be driven by tests. For deleting things, DeleteConfirmModal remains the red variant.
 */
export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  danger = false,
  isLoading = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="mb-2 text-lg font-bold text-slate-900">{title}</h2>
        <p className="mb-6 text-sm text-slate-600">{message}</p>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" disabled={isLoading} onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="button" variant={danger ? 'danger' : 'primary'} disabled={isLoading} onClick={onConfirm}>{confirmLabel ?? t('common.confirm')}</Button>
        </div>
      </div>
    </div>
  );
}
