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
  range: {
    preset: 'last_30_days',
    start: '2026-08-16',
    end: '2026-09-14',
    label: 'Last 30 days',
  },
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

  it('renders DateRangePicker with default Last 30 days and refetches on preset change', async () => {
    vi.mocked(fetchJson).mockResolvedValue({ data: mockData });

    renderWithClient(<ConversionPage />);

    await waitFor(() => {
      expect(screen.getByText('Online Store Conversion')).toBeInTheDocument();
    });

    // Default fetch call
    expect(fetchJson).toHaveBeenCalledWith('/admin/dashboard/conversion?preset=last_30_days');

    // Trigger dropdown
    const rangeButton = screen.getByRole('button', { name: /last 30 days/i });
    fireEvent.click(rangeButton);

    // Click 'Today' preset
    const todayOption = screen.getByRole('menuitem', { name: /^today$/i });
    fireEvent.click(todayOption);

    await waitFor(() => {
      expect(fetchJson).toHaveBeenCalledWith('/admin/dashboard/conversion?preset=today');
    });
  });

  it('refetches with quarter and custom range parameters via DateRangePicker', async () => {
    vi.mocked(fetchJson).mockResolvedValue({ data: mockData });

    renderWithClient(<ConversionPage />);

    await waitFor(() => {
      expect(screen.getByText('Online Store Conversion')).toBeInTheDocument();
    });

    // Select custom range
    const rangeButton = screen.getByRole('button', { name: /last 30 days/i });
    fireEvent.click(rangeButton);

    const customOption = screen.getByRole('menuitem', { name: /custom range/i });
    fireEvent.click(customOption);

    const startInput = screen.getByLabelText(/start date/i);
    const endInput = screen.getByLabelText(/end date/i);

    fireEvent.change(startInput, { target: { value: '2026-09-01' } });
    fireEvent.change(endInput, { target: { value: '2026-09-14' } });

    const applyBtn = screen.getByRole('button', { name: /apply/i });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(fetchJson).toHaveBeenCalledWith(
        '/admin/dashboard/conversion?preset=custom&start_date=2026-09-01&end_date=2026-09-14'
      );
    });
  });
});
