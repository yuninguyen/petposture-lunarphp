import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '@/lib/api';
import { Button } from '@/components/ui/button';

interface MediaItem {
  id: string;
  url: string;
  thumbnail_url: string;
  name: string;
}

export function MediaPicker({
  value,
  onChange,
}: {
  value: { id: string; url: string } | null;
  onChange: (media: { id: string; url: string } | null) => void;
}) {
  const { t } = useTranslation();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  const { data: library } = useQuery({
    queryKey: ['media'],
    queryFn: () => fetchJson<{ data: MediaItem[] }>('/admin/media').then((res) => res.data),
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetchJson<{ data: MediaItem }>('/admin/media', { method: 'POST', body: formData });
      onChange({ id: res.data.id, url: res.data.url });
      queryClient.invalidateQueries({ queryKey: ['media'] });
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  return (
    <div>
      {value ? (
        <div className="mb-3">
          <img src={value.url} alt="" className="w-full max-h-48 object-cover rounded-lg border border-gray-200" />
          <button type="button" onClick={() => onChange(null)} className="text-xs text-red-600 mt-1">
            {t('media.button_remove')}
          </button>
        </div>
      ) : (
        <div className="border-2 border-dashed border-gray-300 rounded-lg h-32 flex items-center justify-center text-sm text-gray-400 mb-3">
          {t('media.empty_state')}
        </div>
      )}

      <input ref={fileInput} type="file" accept="image/*" onChange={handleFileChange} className="hidden" id="media-upload" />
      <label htmlFor="media-upload">
        <Button type="button" variant="primary" disabled={uploading} onClick={() => fileInput.current?.click()}>
          {uploading ? t('media.button_uploading') : t('media.button_upload')}
        </Button>
      </label>

      {library && library.length > 0 && (
        <div className="grid grid-cols-4 gap-2 mt-3">
          {library.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => onChange({ id: item.id, url: item.url })}
              className="border border-gray-200 rounded overflow-hidden hover:border-secondary"
            >
              <img src={item.thumbnail_url} alt={item.name} className="w-full h-16 object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
