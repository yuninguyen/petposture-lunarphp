import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageIcon } from '@/components/ui/icons';
import { MediaLibraryModal, type MediaContext } from '@/components/ui/media-library-modal';

type MediaPickerValue = { id: string | null; url: string } | null;
type MediaPickerChangeHandler = { bivarianceHack(media: MediaPickerValue): void }['bivarianceHack'];
type MediaPickerPreview = 'default' | 'logo' | 'favicon';

export function MediaPicker({
  value,
  onChange,
  fill,
  preview = 'default',
  context,
  disabled = false,
}: {
  value: MediaPickerValue;
  onChange: MediaPickerChangeHandler;
  fill?: boolean;
  preview?: MediaPickerPreview;
  context: MediaContext;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div className={fill ? 'relative h-full w-full' : preview === 'favicon' ? 'w-full max-w-64' : undefined}>
      {value ? (
        <div className={fill ? 'absolute inset-0 flex flex-col' : 'mb-3'}>
          <img
            src={value.url}
            alt=""
            className={
              fill
                ? 'w-full flex-1 min-h-0 object-cover rounded-lg border border-gray-200'
                : preview === 'logo'
                  ? 'h-64 w-full object-contain rounded-lg border border-gray-200 bg-slate-50 p-3'
                : preview === 'favicon'
                  ? 'aspect-square w-full object-contain rounded-lg border border-gray-200 bg-slate-50 p-3'
                : 'w-full max-h-48 object-cover rounded-lg border border-gray-200'
            }
          />
          <div className="mt-1.5 flex gap-4">
            <button type="button" disabled={disabled} onClick={() => setOpen(true)} className="text-xs text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50">
              {t('media.button_browse')}
            </button>
            <button type="button" disabled={disabled} onClick={() => onChange(null)} className="text-xs text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50">
              {t('media.button_remove')}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className={
            fill
              ? 'absolute inset-0 flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-gray-300 text-sm text-gray-400 hover:border-secondary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50'
              : preview === 'logo'
                ? 'flex h-64 w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-gray-300 text-sm text-gray-400 hover:border-secondary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50'
              : preview === 'favicon'
                ? 'flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-gray-300 text-sm text-gray-400 hover:border-secondary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50'
              : 'flex h-28 w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-gray-300 text-sm text-gray-400 hover:border-secondary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50'
          }
        >
          <ImageIcon className="h-6 w-6" />
          {t('media.button_browse')}
        </button>
      )}

      <MediaLibraryModal
        open={open}
        context={context}
        onClose={() => setOpen(false)}
        onSelect={(media) => {
          onChange(media);
          setOpen(false);
        }}
      />
    </div>
  );
}
