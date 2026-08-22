import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageIcon } from '@/components/ui/icons';
import { MediaLibraryModal } from '@/components/ui/media-library-modal';

export function MediaPicker({
  value,
  onChange,
}: {
  value: { id: string; url: string } | null;
  onChange: (media: { id: string; url: string } | null) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div>
      {value ? (
        <div className="mb-3">
          <img src={value.url} alt="" className="w-full max-h-48 object-cover rounded-lg border border-gray-200" />
          <div className="mt-1.5 flex gap-4">
            <button type="button" onClick={() => setOpen(true)} className="text-xs text-primary hover:underline">
              {t('media.button_browse')}
            </button>
            <button type="button" onClick={() => onChange(null)} className="text-xs text-red-600 hover:underline">
              {t('media.button_remove')}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-28 w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-gray-300 text-sm text-gray-400 hover:border-secondary hover:text-primary"
        >
          <ImageIcon className="h-6 w-6" />
          {t('media.button_browse')}
        </button>
      )}

      <MediaLibraryModal
        open={open}
        onClose={() => setOpen(false)}
        onSelect={(media) => {
          onChange(media);
          setOpen(false);
        }}
      />
    </div>
  );
}
