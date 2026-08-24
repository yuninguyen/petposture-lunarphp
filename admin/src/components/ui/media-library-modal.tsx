import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '@/lib/api';
import { Button } from './button';

export const MEDIA_FOLDERS = ['banner', 'blog', 'product', 'breed', 'solution', 'general'] as const;
export type MediaContext = (typeof MEDIA_FOLDERS)[number];
type FolderFilter = MediaContext | 'all';

export interface MediaItem {
  id: string;
  url: string;
  thumbnail_url: string;
  name: string;
  alt?: string | null;
  folder?: MediaContext | null;
}

interface MediaLibraryModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (media: { id: string; url: string }) => void;
  context?: MediaContext;
}

export function filterMediaItems(items: MediaItem[], search: string): MediaItem[] {
  const needle = search.trim().toLowerCase();
  if (!needle) return items;
  return items.filter((item) => `${item.name} ${item.alt ?? ''}`.toLowerCase().includes(needle));
}

export function MediaLibraryModal({ open, onClose, onSelect, context = 'general' }: MediaLibraryModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [folder, setFolder] = useState<FolderFilter>(context);
  const [search, setSearch] = useState('');

  useEffect(() => { if (open) { setFolder(context); setSearch(''); } }, [context, open]);

  const { data: library = [] } = useQuery({
    queryKey: ['media', folder],
    queryFn: async () => {
      const query = folder === 'all' ? '' : `?folder=${folder}`;
      const res = await fetchJson<{ data: MediaItem[] }>(`/admin/media${query}`);
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: open,
  });
  const filteredLibrary = filterMediaItems(library, search);

  if (!open) return null;

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const uploadFolder = folder === 'all' ? context : folder;
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', uploadFolder);
      const res = await fetchJson<{ data: MediaItem }>('/admin/media', { method: 'POST', body: formData });
      queryClient.setQueryData<MediaItem[]>(['media'], (old) => [res.data, ...(old ?? [])]);
      queryClient.invalidateQueries({ queryKey: ['media'] });
      onSelect({ id: res.data.id, url: res.data.url });
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function moveToFolder(item: MediaItem, nextFolder: MediaContext) {
    await fetchJson(`/admin/media/${item.id}`, { method: 'PATCH', body: { folder: nextFolder } });
    queryClient.invalidateQueries({ queryKey: ['media'] });
  }

  return createPortal(<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}><div className="w-full max-w-6xl rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true"><div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold text-ink">{t('media.select_title')}</h3><button type="button" onClick={onClose} className="text-2xl leading-none text-gray-400 hover:text-ink" aria-label={t('media.button_close')}>×</button></div><div className="flex min-h-[28rem] gap-5"><aside className="w-40 shrink-0 border-r border-gray-200 pr-4"><p className="mb-2 text-xs font-semibold uppercase text-gray-400">{t('media.folders')}</p>{(['all', ...MEDIA_FOLDERS] as FolderFilter[]).map((item) => <button key={item} type="button" onClick={() => setFolder(item)} className={`mb-1 w-full rounded px-3 py-2 text-left text-sm capitalize ${folder === item ? 'bg-primary text-white' : 'hover:bg-gray-100'}`}>{t(`media.folder_${item}`)}</button>)}</aside><main className="min-w-0 flex-1"><div className="mb-4 flex flex-wrap items-center gap-3"><input ref={fileInput} type="file" accept="image/*" onChange={handleUpload} className="hidden"/><Button type="button" variant="secondary" disabled={uploading} onClick={() => fileInput.current?.click()}>{uploading ? t('media.button_uploading') : t('media.button_upload')}</Button><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('media.search_placeholder')} className="h-10 min-w-64 flex-1 rounded-lg border border-gray-300 px-3 text-sm"/><span className="text-xs text-gray-400">{t('media.upload_folder', { folder: t(`media.folder_${folder === 'all' ? context : folder}`) })}</span></div>{filteredLibrary.length ? <div className="grid max-h-[24rem] grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-4 lg:grid-cols-5">{filteredLibrary.map((item) => <div key={item.id} className="group overflow-hidden rounded border border-gray-200"><button type="button" onClick={() => onSelect({ id: item.id, url: item.url })} className="block w-full hover:opacity-90"><img src={item.thumbnail_url} alt={item.alt || item.name} className="h-28 w-full object-cover"/></button><div className="space-y-1 p-2"><p className="truncate text-xs" title={item.name}>{item.name}</p><select aria-label={t('media.move_folder')} value={item.folder ?? 'general'} onChange={(event) => moveToFolder(item, event.target.value as MediaContext)} className="h-7 w-full rounded border border-gray-200 bg-white px-1 text-xs">{MEDIA_FOLDERS.map((option) => <option key={option} value={option}>{t(`media.folder_${option}`)}</option>)}</select></div></div>)}</div> : <p className="py-8 text-center text-sm text-gray-400">{search ? t('media.no_search_results') : t('media.empty_state')}</p>}</main></div></div></div>, document.body);
}
