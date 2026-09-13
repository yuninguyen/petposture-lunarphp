import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ConversionPage } from './ConversionPage';
import type { ConversionData } from './api';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, fetchJson: vi.fn() };
});

import { fetchJson } from '@/lib/api';

const mockData: ConversionData = {
  range: '30',
  carts_created: 120,
  checkouts_started: 80,
  orders_completed: 45,
  cart_abandonment_rate: 0.3333,
  checkout_abandonment_rate: 0.4375,
};

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  );
}

describe('ConversionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    vi.mocked(fetchJson).mockImplementation(() => new Promise(() => {}));

    const { container } = renderWithClient(<ConversionPage />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders error state on API failure', async () => {
    vi.mocked(fetchJson).mockRejectedValue(new Error('Network error'));

    renderWithClient(<ConversionPage />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load conversion data/i)).toBeInTheDocument();
    });
  });

  it('renders conversion funnel stages and distinct abandonment rates', async () => {
    vi.mocked(fetchJson).mockResolvedValue({ data: mockData });

    renderWithClient(<ConversionPage />);

    await waitFor(() => {
      expect(screen.getByText('Online Store Conversion')).toBeInTheDocument();
    });

    // 3 Stage counts
    expect(screen.getByTestId('carts-created-count')).toHaveTextContent('120');
    expect(screen.getByTestId('checkouts-started-count')).toHaveTextContent('80');
    expect(screen.getByTestId('orders-completed-count')).toHaveTextContent('45');

    // 2 Distinct abandonment rates
    // 0.3333 * 100 = 33.3%
    // 0.4375 * 100 = 43.8%
    const cartRate = screen.getByTestId('cart-abandonment-rate');
    const checkoutRate = screen.getByTestId('checkout-abandonment-rate');

    expect(cartRate).toHaveTextContent('33.3%');
    expect(checkoutRate).toHaveTextContent('43.8%');
    expect(cartRate.textContent).not.toEqual(checkoutRate.textContent);

    // Drop-off counts
    // 120 - 80 = 40
    // 80 - 45 = 35
    expect(screen.getByTestId('cart-dropoff-count')).toHaveTextContent('40');
    expect(screen.getByTestId('checkout-dropoff-count')).toHaveTextContent('35');

    // Overall conversion rate: 45 / 120 = 37.5%
    expect(screen.getByTestId('overall-conversion-rate')).toHaveTextContent('37.5%');
  });

  it('provides range options (7, 30, 90, all) and strictly excludes 365/1-year', async () => {
    vi.mocked(fetchJson).mockResolvedValue({ data: mockData });

    renderWithClient(<ConversionPage />);

    await waitFor(() => {
      expect(screen.getByText('Online Store Conversion')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: '7 days' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30 days' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '90 days' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All time' })).toBeInTheDocument();

    // Must NOT have 365 days / 1 year button
    expect(screen.queryByRole('button', { name: /1 year/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /365/i })).not.toBeInTheDocument();
  });

  it('refetches data when switching range pills', async () => {
    vi.mocked(fetchJson).mockResolvedValue({ data: mockData });

    renderWithClient(<ConversionPage />);

    await waitFor(() => {
      expect(fetchJson).toHaveBeenCalledWith('/admin/dashboard/conversion?range=30');
    });

    // Click '7 days' pill
    const sevenDaysButton = await screen.findByRole('button', { name: '7 days' });
    fireEvent.click(sevenDaysButton);

    await waitFor(() => {
      expect(fetchJson).toHaveBeenCalledWith('/admin/dashboard/conversion?range=7');
    });

    // Click 'All time' pill
    const allTimeButton = await screen.findByRole('button', { name: 'All time' });
    fireEvent.click(allTimeButton);

    await waitFor(() => {
      expect(fetchJson).toHaveBeenCalledWith('/admin/dashboard/conversion?range=all');
    });
  });
});
