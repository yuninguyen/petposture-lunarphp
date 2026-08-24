import { createRoot } from 'react-dom/client';
import { act, createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { filterMediaItems, MediaLibraryModal, MEDIA_FOLDERS, type MediaItem } from '@/components/ui/media-library-modal';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: [] }),
  useQueryClient: () => ({ setQueryData: vi.fn(), invalidateQueries: vi.fn() }),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const items: MediaItem[] = [
  { id: '1', url: '/cat.jpg', thumbnail_url: '/cat-thumb.jpg', name: 'Cat harness', alt: 'Orange pet', folder: 'product' },
  { id: '2', url: '/dog.jpg', thumbnail_url: '/dog-thumb.jpg', name: 'Dog posture', alt: null, folder: 'blog' },
];

describe('media library folders and search', () => {
  it('keeps the fixed backend folder values', () => {
    expect(MEDIA_FOLDERS).toEqual(['banner', 'blog', 'product', 'breed', 'solution', 'general']);
  });

  it('filters case-insensitively by name or alt text', () => {
    expect(filterMediaItems(items, 'HARNESS')).toEqual([items[0]]);
    expect(filterMediaItems(items, 'orange')).toEqual([items[0]]);
    expect(filterMediaItems(items, 'posture')).toEqual([items[1]]);
  });

  it('renders the open dialog through document.body instead of its component container', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    act(() => {
      root.render(createElement(MediaLibraryModal, { open: true, context: 'product', onClose: vi.fn(), onSelect: vi.fn() }));
    });

    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();

    act(() => root.unmount());
    host.remove();
  });
});
