import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { MediaLibraryPage } from './MediaLibraryPage';
import type { MediaLibraryItem, MediaLibraryResponse } from './api';

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({ default: toast }));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, fetchJson: vi.fn() };
});

import { fetchJson } from '@/lib/api';

const mockCuratorItem: MediaLibraryItem = {
  id: 1,
  source: 'curator',
  url: 'https://example.com/curator-1.jpg',
  thumbnail_url: 'https://example.com/curator-1-thumb.jpg',
  name: 'curator-image.jpg',
  folder: 'breed',
  collection_name: null,
  model_type: null,
  size: 10240,
  created_at: '2026-09-14T10:00:00.000Z',
};

const mockSpatieItem: MediaLibraryItem = {
  id: 2,
  source: 'spatie',
  url: 'https://example.com/spatie-2.jpg',
  thumbnail_url: 'https://example.com/spatie-2-thumb.jpg',
  name: 'product-photo.jpg',
  folder: null,
  collection_name: 'images',
  model_type: 'Product',
  size: 20480,
  created_at: '2026-09-14T11:00:00.000Z',
};

const mockPage1Response: MediaLibraryResponse = {
  data: [mockCuratorItem, mockSpatieItem],
  meta: {
    current_page: 1,
    last_page: 2,
    per_page: 24,
    total: 26,
  },
};

const mockPage2Response: MediaLibraryResponse = {
  data: [
    {
      ...mockCuratorItem,
      id: 3,
      name: 'page2-file.jpg',
    },
  ],
  meta: {
    current_page: 2,
    last_page: 2,
    per_page: 24,
    total: 26,
  },
};

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  );
}

describe('MediaLibraryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchJson).mockImplementation(async (url, options) => {
      if (typeof url === 'string' && url.includes('/admin/system/media')) {
        if (options?.method === 'DELETE') {
          return {} as unknown;
        }
        if (url.includes('&page=2') || url.includes('?page=2')) {
          return mockPage2Response as unknown;
        }
        return mockPage1Response as unknown;
      }
      return {} as unknown;
    });
  });

  it('renders thumbnail grid with items and correct source badges', async () => {
    renderWithClient(<MediaLibraryPage />);

    expect(await screen.findByText('curator-image.jpg')).toBeInTheDocument();
    expect(screen.getByText('product-photo.jpg')).toBeInTheDocument();

    // Curator folder badge
    expect(screen.getByText('breed')).toBeInTheDocument();

    // Spatie attached badge
    expect(screen.getByText(/Attached to Product/i)).toBeInTheDocument();
  });

  it('switches filter tabs and triggers API calls with correct source param', async () => {
    renderWithClient(<MediaLibraryPage />);

    await screen.findByText('curator-image.jpg');

    // Click "Curator" tab
    const curatorTab = screen.getByRole('button', { name: /^Curator$/i });
    fireEvent.click(curatorTab);

    await waitFor(() => {
      expect(fetchJson).toHaveBeenCalledWith(
        expect.stringContaining('source=curator')
      );
    });

    // Click "Attached" tab (which sends source=spatie)
    const attachedTab = screen.getByRole('button', { name: /^Attached$/i });
    fireEvent.click(attachedTab);

    await waitFor(() => {
      expect(fetchJson).toHaveBeenCalledWith(
        expect.stringContaining('source=spatie')
      );
    });
  });

  it('handles pagination navigation and disables buttons at boundaries', async () => {
    renderWithClient(<MediaLibraryPage />);

    await screen.findByText('curator-image.jpg');

    const prevBtn = screen.getByRole('button', { name: /Previous/i });
    const nextBtn = screen.getByRole('button', { name: /Next/i });

    // On page 1, Previous is disabled
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).not.toBeDisabled();

    // Click Next
    fireEvent.click(nextBtn);

    expect(await screen.findByText('page2-file.jpg')).toBeInTheDocument();

    // On page 2 (last page), Next is disabled
    expect(screen.getByRole('button', { name: /Next/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Previous/i })).not.toBeDisabled();
  });

  it('successfully deletes a media item and shows success toast', async () => {
    renderWithClient(<MediaLibraryPage />);

    await screen.findByText('curator-image.jpg');

    const deleteButtons = screen.getAllByLabelText('Delete');
    fireEvent.click(deleteButtons[0]);

    // Delete modal opens
    expect(screen.getByText('Delete Media File')).toBeInTheDocument();
    expect(screen.getByText(/curator-image\.jpg/)).toBeInTheDocument();

    const deleteButtonsInDom = screen.getAllByRole('button', { name: /^Delete$/i });
    const confirmBtn = deleteButtonsInDom[deleteButtonsInDom.length - 1];
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(fetchJson).toHaveBeenCalledWith('/admin/system/media/curator/1', {
        method: 'DELETE',
      });
      expect(toast.success).toHaveBeenCalledWith('Media file deleted successfully');
    });
  });

  it('handles 409 MEDIA_IN_USE conflict with formatted usages toast and preserves item in grid', async () => {
    const conflictError = new Error('In use error') as Error & {
      status?: number;
      data?: {
        code?: string;
        message?: string;
        details?: {
          usages?: Array<{ type: string; id: number; label: string }>;
        };
      };
    };
    conflictError.status = 409;
    conflictError.data = {
      code: 'MEDIA_IN_USE',
      message: 'This file is currently used elsewhere and cannot be deleted.',
      details: {
        usages: [
          { type: 'Breed', id: 1, label: 'Corgi' },
          { type: 'Product', id: 42, label: 'Puppia Harness' },
        ],
      },
    };

    vi.mocked(fetchJson).mockImplementation(async (url, options) => {
      if (typeof url === 'string' && url.includes('/admin/system/media')) {
        if (options?.method === 'DELETE') {
          throw conflictError;
        }
        return mockPage1Response as unknown;
      }
      return {} as unknown;
    });

    renderWithClient(<MediaLibraryPage />);

    await screen.findByText('curator-image.jpg');

    const deleteButtons = screen.getAllByLabelText('Delete');
    fireEvent.click(deleteButtons[0]);

    const deleteButtonsInDom = screen.getAllByRole('button', { name: /^Delete$/i });
    const confirmBtn = deleteButtonsInDom[deleteButtonsInDom.length - 1];
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Breed "Corgi", Product "Puppia Harness"')
      );
    });

    // Item remains in grid
    expect(screen.getByText('curator-image.jpg')).toBeInTheDocument();
  });
});
