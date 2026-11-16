import { ReactNode, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { CopyIcon, PencilIcon, TrashIcon } from '@/components/ui/icons';
import { PinterestPin, downloadPinImage, markPinPosted, pinterestPinsKey } from './api';
import { copyToClipboard } from './clipboard';

const buttonClass =
  'inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50';

function ActionButton({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`${buttonClass} ${danger ? 'hover:bg-red-50 hover:text-red-600' : ''}`}
    >
      {children}
    </button>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0 0l-4-4m4 4l4-4" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

/** What Yuni does with a pin: take the image, copy the text, post it by hand, then mark it posted. */
export function PinterestPinRowActions({ pin, onEdit, onDelete }: { pin: PinterestPin; onEdit: (pin: PinterestPin) => void; onDelete: (pin: PinterestPin) => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [downloading, setDownloading] = useState(false);

  const postedMutation = useMutation({
    mutationFn: () => markPinPosted(pin.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pinterestPinsKey });
      toast.success(t('pinterest_pins.marked_posted'));
    },
    onError: (error: Error) => toast.error(error.message || t('common.error_occurred')),
  });

  async function copy(text: string, successKey: string) {
    if (await copyToClipboard(text)) {
      toast.success(t(successKey));
    } else {
      toast.error(t('pinterest_pins.copy_failed'));
    }
  }

  async function download() {
    setDownloading(true);
    try {
      await downloadPinImage(pin);
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : t('pinterest_pins.download_failed'));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-0.5">
      <ActionButton label={t('pinterest_pins.action_download')} onClick={download} disabled={downloading}>
        <DownloadIcon className="h-4 w-4" />
      </ActionButton>
      <ActionButton label={t('pinterest_pins.action_copy_title')} onClick={() => copy(pin.title, 'pinterest_pins.copied_title')}>
        <CopyIcon className="h-4 w-4" />
      </ActionButton>
      <ActionButton label={t('pinterest_pins.action_copy_description')} onClick={() => copy(pin.description, 'pinterest_pins.copied_description')}>
        <CopyIcon className="h-4 w-4 opacity-60" />
      </ActionButton>
      {pin.status !== 'posted' && (
        <ActionButton label={t('pinterest_pins.action_mark_posted')} onClick={() => postedMutation.mutate()} disabled={postedMutation.isPending}>
          <CheckCircleIcon className="h-4 w-4" />
        </ActionButton>
      )}
      <ActionButton label={t('pinterest_pins.action_edit')} onClick={() => onEdit(pin)}>
        <PencilIcon className="h-4 w-4" />
      </ActionButton>
      <ActionButton label={t('pinterest_pins.action_delete')} onClick={() => onDelete(pin)} danger>
        <TrashIcon className="h-4 w-4" />
      </ActionButton>
    </div>
  );
}
