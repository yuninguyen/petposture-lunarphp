import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AffiliateReportsPage } from './AffiliateReportsPage';
import type { AffiliateReportsResponse } from './api';
import '@/i18n';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, fetchJson: vi.fn() };
});

import { fetchJson } from '@/lib/api';

const mockReportsResponse: AffiliateReportsResponse = {
  range: '30',
  overview: {
    clicks_7d: 145,
    clicks_30d: 680,
    clicks_all_time: 2350,
    top_network_30d: {
      name: 'Impact Radius',
      clicks: 420,
    },
    conversions_synced: 18,
    commission_amount_synced: 350.5,
    has_synced_data: true,
  },
  by_network: [
    {
      network_id: 1,
      network_name: 'Impact Radius',
      network_slug: 'impact',
      clicks: 420,
      is_configured: true,
      last_synced_at: '2026-09-15T12:00:00.000000Z',
      synced_conversions: 15,
      synced_commission: 310.0,
    },
    {
      network_id: 2,
      network_name: 'Chewy Affiliate',
      network_slug: 'chewy',
      clicks: 260,
      is_configured: false,
      last_synced_at: null,
      synced_conversions: null,
      synced_commission: null,
    },
  ],
  by_post: [
    {
      post_id: 101,
      post_title: 'Best Harness for Golden Retrievers',
      clicks: 340,
    },
    {
      post_id: 102,
      post_title: 'Top 5 Orthopedic Dog Beds',
      clicks: 210,
    },
  ],
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AffiliateReportsPage />
    </QueryClientProvider>
  );
}

describe('AffiliateReportsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders overview stat cards, top network, and tables', async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce(mockReportsResponse);

    renderPage();

    expect(screen.getByText(/Loading affiliate reports/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('145')).toBeInTheDocument(); // clicks 7d
    });

    expect(screen.getByText('680')).toBeInTheDocument(); // clicks 30d
    expect(screen.getByText('2,350')).toBeInTheDocument(); // clicks all time
    expect(screen.getAllByText('Impact Radius').length).toBeGreaterThanOrEqual(1);

    // Synced metrics
    expect(screen.getByText('$350.50')).toBeInTheDocument();

    // Tables
    expect(screen.getByText('Best Harness for Golden Retrievers')).toBeInTheDocument();
    expect(screen.getByText('340')).toBeInTheDocument();
    expect(screen.getByText('Chewy Affiliate')).toBeInTheDocument();
  });

  it('handles date range filter switching', async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce(mockReportsResponse);
    vi.mocked(fetchJson).mockResolvedValueOnce({
      ...mockReportsResponse,
      range: '7',
      overview: { ...mockReportsResponse.overview, clicks_30d: 145 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('680')).toBeInTheDocument();
    });

    const range7Btn = screen.getByRole('button', { name: /last 7 days/i });
    fireEvent.click(range7Btn);

    await waitFor(() => {
      expect(fetchJson).toHaveBeenCalledWith('/admin/affiliate/reports?range=7');
    });
  });

  it('displays no synced data state when has_synced_data is false', async () => {
    const noSyncResponse: AffiliateReportsResponse = {
      ...mockReportsResponse,
      overview: {
        ...mockReportsResponse.overview,
        has_synced_data: false,
        conversions_synced: null,
        commission_amount_synced: null,
      },
    };

    vi.mocked(fetchJson).mockResolvedValueOnce(noSyncResponse);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/No synced conversion data for this period/i)).toBeInTheDocument();
    });
  });

  it('displays empty state notices when there are no clicks or posts in period', async () => {
    const emptyResponse: AffiliateReportsResponse = {
      range: '30',
      overview: {
        clicks_7d: 0,
        clicks_30d: 0,
        clicks_all_time: 0,
        top_network_30d: null,
        conversions_synced: null,
        commission_amount_synced: null,
        has_synced_data: false,
      },
      by_network: [],
      by_post: [],
    };

    vi.mocked(fetchJson).mockResolvedValueOnce(emptyResponse);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/No clicks recorded for any network in this period/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/No clicks recorded for any post in this period/i)).toBeInTheDocument();
  });
});
