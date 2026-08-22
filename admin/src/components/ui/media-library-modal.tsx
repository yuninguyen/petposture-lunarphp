import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '@/lib/api';
import { Button } from './button';

interface MediaItem {
  id: string;
  url: string;
  thumbnail_url: string;
  name: string;
}

interface MediaLibraryModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (media: { id: string; url: string }) => void;
}

export function MediaLibraryModal({ open, onClose, onSelect }: MediaLibraryModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: library } = useQuery({
    queryKey: ['media'],
    queryFn: async () => {
      const res = await fetchJson<{ data: MediaItem[] }>('/admin/media');
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: open,
  });

  if (!open) {
    return null;
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetchJson<{ data: MediaItem }>('/admin/media', { method: 'POST', body: formData });
      // Optimistically add the fresh media to the shared cache so the parent's
      // preview (looked up by id) renders immediately after the modal closes.
      queryClient.setQueryData<MediaItem[]>(['media'], (old) => [res.data, ...(old ?? [])]);
      queryClient.invalidateQueries({ queryKey: ['media'] });
      onSelect({ id: res.data.id, url: res.data.url });
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-ink">{t('media.select_title')}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl leading-none text-gray-400 hover:text-ink"
            aria-label={t('media.button_close')}
          >
            ×
          </button>
        </div>

        <div className="mb-4 flex items-center gap-3">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="hidden"
            id="media-modal-upload"
          />
          <Button type="button" variant="secondary" disabled={uploading} onClick={() => fileInput.current?.click()}>
            {uploading ? t('media.button_uploading') : t('media.button_upload')}
          </Button>
          <span className="text-xs text-gray-400">{t('media.upload_hint')}</span>
        </div>

        {library && library.length > 0 ? (
          <div className="grid max-h-80 grid-cols-4 gap-2 overflow-y-auto">
            {library.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => onSelect({ id: item.id, url: item.url })}
                className="overflow-hidden rounded border border-gray-200 hover:border-secondary"
              >
                <img src={item.thumbnail_url} alt={item.name} className="h-20 w-full object-cover" />
              </button>
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-gray-400">{t('media.empty_state')}</p>
        )}
      </div>
    </div>
  );
}
