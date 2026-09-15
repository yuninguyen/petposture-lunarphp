import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AffiliateNetworksPage } from './AffiliateNetworksPage';
import type { AffiliateNetworkItem } from './api';
import '@/i18n';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, fetchJson: vi.fn() };
});

import { fetchJson } from '@/lib/api';

const mockNetworks: AffiliateNetworkItem[] = [
  {
    id: 1,
    name: 'Impact Radius',
    slug: 'impact',
    logo: 'https://example.com/impact.png',
    active: true,
    provider: 'impact',
    merchant_id: '12345',
    commission_rate_default: 10,
    cookie_days: 30,
    is_configured: true,
    last_synced_at: '2026-09-15T12:00:00.000000Z',
    created_at: '2026-09-01T00:00:00.000000Z',
    updated_at: '2026-09-15T12:00:00.000000Z',
  },
  {
    id: 2,
    name: 'Chewy Affiliate',
    slug: 'chewy',
    logo: null,
    active: false,
    provider: null,
    merchant_id: null,
    commission_rate_default: 5,
    cookie_days: 15,
    is_configured: false,
    last_synced_at: null,
    created_at: '2026-09-01T00:00:00.000000Z',
    updated_at: '2026-09-01T00:00:00.000000Z',
  },
];

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AffiliateNetworksPage />
    </QueryClientProvider>
  );
}

describe('AffiliateNetworksPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders network list with status, configured badge, and action buttons', async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce({ data: mockNetworks });

    renderPage();

    expect(screen.getByText(/Loading affiliate networks/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Impact Radius')).toBeInTheDocument();
    });

    expect(screen.getByText('Chewy Affiliate')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByText('Configured')).toBeInTheDocument();
    expect(screen.getByText('Unconfigured')).toBeInTheDocument();
  });

  it('disables Sync button when network is unconfigured', async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce({ data: mockNetworks });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Chewy Affiliate')).toBeInTheDocument();
    });

    // The Chewy row is the 2nd row; its Sync button must be disabled
    const syncButtons = screen.getAllByRole('button', { name: /sync now/i });
    expect(syncButtons[0]).not.toBeDisabled(); // Impact (configured)
    expect(syncButtons[1]).toBeDisabled(); // Chewy (unconfigured)
  });

  it('triggers sync mutation when clicking Sync Now on a configured network', async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce({ data: mockNetworks });
    vi.mocked(fetchJson).mockResolvedValueOnce({ message: 'Sync triggered successfully' });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Impact Radius')).toBeInTheDocument();
    });

    const syncButtons = screen.getAllByRole('button', { name: /sync now/i });
    fireEvent.click(syncButtons[0]);

    await waitFor(() => {
      expect(fetchJson).toHaveBeenCalledWith('/admin/affiliate/networks/1/sync', {
        method: 'POST',
      });
    });
  });

  it('opens create modal and submits new network', async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce({ data: mockNetworks });
    vi.mocked(fetchJson).mockResolvedValueOnce({
      data: {
        id: 3,
        name: 'Amazon Associates',
        slug: 'amazon',
        logo: null,
        active: true,
        provider: 'amazon',
        merchant_id: null,
        commission_rate_default: 4,
        cookie_days: 1,
        is_configured: true,
        last_synced_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Impact Radius')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /new network/i }));

    expect(screen.getByRole('heading', { name: /create affiliate network/i })).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText(/e\.g\. Impact, CJ, Chewy/i);
    fireEvent.change(nameInput, { target: { value: 'Amazon Associates' } });

    const submitBtn = screen.getByRole('button', { name: /save network/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(fetchJson).toHaveBeenCalledWith(
        '/admin/affiliate/networks',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  it('opens edit modal and preserves secrets when left blank', async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce({ data: mockNetworks });
    vi.mocked(fetchJson).mockResolvedValueOnce({
      data: { ...mockNetworks[0], name: 'Impact Radius Updated' },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Impact Radius')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByRole('button', { name: /edit/i });
    fireEvent.click(editButtons[0]);

    expect(screen.getByRole('heading', { name: /edit affiliate network/i })).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText(/e\.g\. Impact, CJ, Chewy/i);
    fireEvent.change(nameInput, { target: { value: 'Impact Radius Updated' } });

    // Leave api_key and api_secret blank
    const submitBtn = screen.getByRole('button', { name: /save network/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(fetchJson).toHaveBeenCalledWith(
        '/admin/affiliate/networks/1',
        expect.objectContaining({
          method: 'PUT',
        })
      );
    });

    // Check payload passed to fetchJson: api_key and api_secret should NOT be present
    const callArgs = vi.mocked(fetchJson).mock.calls.find((c) => c[0] === '/admin/affiliate/networks/1');
    expect(callArgs).toBeDefined();
    const sentBody = callArgs![1]!.body as Record<string, unknown>;
    expect(sentBody.name).toBe('Impact Radius Updated');
    expect(sentBody.api_key).toBeUndefined();
    expect(sentBody.api_secret).toBeUndefined();
  });

  it('opens delete confirmation and deletes network', async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce({ data: mockNetworks });
    vi.mocked(fetchJson).mockResolvedValueOnce({ message: 'Deleted' });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Impact Radius')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    fireEvent.click(deleteButtons[0]);

    // Confirmation dialog appears
    expect(screen.getByText(/Are you sure you want to delete "Impact Radius"\?/i)).toBeInTheDocument();

    // Confirm delete inside dialog (aria-label includes the network name to
    // disambiguate from the row's own "Delete" action button)
    const confirmDeleteBtn = screen.getByRole('button', { name: /delete impact radius/i });
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(fetchJson).toHaveBeenCalledWith('/admin/affiliate/networks/1', {
        method: 'DELETE',
      });
    });
  });
});
