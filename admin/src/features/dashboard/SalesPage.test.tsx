import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { SalesPage } from './SalesPage';
import type { DashboardSalesData } from './api';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, fetchJson: vi.fn() };
});

import { fetchJson } from '@/lib/api';

const mockData: DashboardSalesData = {
  range: {
    preset: 'last_30_days',
    start: '2026-08-16',
    end: '2026-09-14',
    label: 'Last 30 days',
    comparison_active: true,
  },
  currency: 'USD',
  stats: {
    sales: { raw: 125000, decimal: 1250.0, currency: 'USD', trend: 15.2 },
    orders: { count: 25, trend: 8.5 },
    aov: { raw: 5000, decimal: 50.0, currency: 'USD', trend: 6.1 },
    active_users: { value: null, status: 'not_connected', formatted: '—' },
  },
  returns_summary: {
    refund_rate: 4.2,
    refund_trend: -1.5,
    pending_review: 2,
    overdue: 1,
    awaiting_completion: 6,
  },
  sales_over_time: {
    granularity: 'day',
    categories: ['Sep 1', 'Sep 2', 'Sep 3'],
    series: {
      revenue: [450.0, 320.0, 480.0],
      orders: [9, 6, 10],
    },
  },
  order_pipeline: {
    awaiting_payment: 3,
    processing: 5,
    shipped: 8,
    delivered: 14,
  },
  top_products: [
    {
      id: 101,
      description: 'Orthopedic Dog Harness',
      sku: 'HARN-PRO-01',
      quantity: 12,
      revenue: { raw: 60000, decimal: 600.0, currency: 'USD' },
    },
  ],
  sales_by_category: [
    {
      name: 'Posture Harnesses',
      revenue: { raw: 90000, decimal: 900.0, currency: 'USD' },
    },
  ],
  recent_orders: [
    {
      id: 1,
      reference: 'PP-1001',
      customer_name: 'Jane Doe',
      status: 'delivered',
      total: { raw: 7500, decimal: 75.0, currency: 'USD' },
      placed_at: '2026-09-10T12:00:00Z',
      created_at: '2026-09-10T12:00:00Z',
    },
  ],
  recent_activity: [
    {
      icon: 'shopping-cart',
      color: '#df8448',
      title: 'Order Placed',
      description: 'Order #PP-1001 was placed',
      at: '2026-09-10T12:00:00Z',
    },
  ],
  traffic_sources: {
    status: 'not_connected',
    items: [
      { label: 'Direct', percent: null, color: '#df8448' },
    ],
  },
  goals: [
    {
      key: 'monthly_revenue_target',
      label: 'Monthly Revenue Target',
      actual: 1300.0,
      target: 2000.0,
      percent: 65,
      uncapped_percent: 65.0,
      unit: 'currency',
    },
    {
      key: 'monthly_orders_target',
      label: 'Monthly Orders Target',
      actual: 33,
      target: null,
      percent: null,
      uncapped_percent: null,
      unit: 'number',
    },
  ],
};

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {ui}
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe('SalesPage', () => {
  beforeEach(() => {
    vi.mocked(fetchJson).mockResolvedValue({ data: mockData });
  });

  it('renders all 4 primary KPI cards with active users explicitly unavailable', async () => {
    renderWithClient(<SalesPage />);

    expect(await screen.findByText('$1,250.00')).toBeInTheDocument();
    expect(screen.getByText('+15.2%')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('$50.00')).toBeInTheDocument();

    // Active users MUST be '—' and labeled as not connected
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
    expect(screen.getAllByText(/not connected/i).length).toBeGreaterThan(0);
  });

  it('renders returns summary with refund rate, pending, and overdue counts', async () => {
    renderWithClient(<SalesPage />);

    expect(await screen.findByText('4.2%')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // pending review
    expect(screen.getByText('1')).toBeInTheDocument(); // overdue
  });

  it('renders order pipeline stages with their counts', async () => {
    renderWithClient(<SalesPage />);

    await screen.findByText('$1,250.00');
    expect(screen.getByText('Awaiting Payment')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Delivered')).toBeInTheDocument();
    expect(screen.getByText('14')).toBeInTheDocument();
  });

  it('renders top products and recent orders', async () => {
    renderWithClient(<SalesPage />);

    expect(await screen.findByText('Orthopedic Dog Harness')).toBeInTheDocument();
    expect(screen.getByText('HARN-PRO-01')).toBeInTheDocument();
    expect(screen.getByText('$600.00')).toBeInTheDocument();

    expect(screen.getByText('PP-1001')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  });

  it('honestly labels the system activity feed as Recent system activity', async () => {
    renderWithClient(<SalesPage />);

    expect(await screen.findByText('Recent system activity')).toBeInTheDocument();
    expect(screen.getByText('Order #PP-1001 was placed')).toBeInTheDocument();
    expect(document.querySelector('.lucide-shopping-cart')).not.toBeNull();
  });

  it('renders goal progress bars and target indicators', async () => {
    renderWithClient(<SalesPage />);

    expect(await screen.findByText('Monthly Revenue Target')).toBeInTheDocument();
    expect(screen.getByText('65%')).toBeInTheDocument();
    expect(screen.getByText(/Target: \$2,000/i)).toBeInTheDocument();
    expect(screen.getByText('No target set')).toBeInTheDocument();
  });

  it('initial render sends a request with preset=last_30_days&comparison=none', async () => {
    renderWithClient(<SalesPage />);
    await screen.findByText('$1,250.00');

    expect(fetchJson).toHaveBeenCalledWith(
      expect.stringContaining('/admin/dashboard/sales?preset=last_30_days&comparison=none')
    );
  });

  it('refetches with new preset when selecting range via DateRangePicker', async () => {
    renderWithClient(<SalesPage />);
    await screen.findByText('$1,250.00');

    const rangeTrigger = screen.getByRole('button', { name: /last 30 days/i });
    fireEvent.click(rangeTrigger);

    const todayOption = screen.getByRole('menuitem', { name: /^today$/i });
    fireEvent.click(todayOption);

    await waitFor(() => {
      expect(fetchJson).toHaveBeenCalledWith(
        expect.stringContaining('preset=today&comparison=none')
      );
    });
  });

  it('adds comparison query parameters when selecting comparison via ComparisonPicker', async () => {
    renderWithClient(<SalesPage />);
    await screen.findByText('$1,250.00');

    const compareTrigger = screen.getByRole('button', { name: /no comparison/i });
    fireEvent.click(compareTrigger);

    const prevYearOption = screen.getByRole('menuitem', { name: /^previous year$/i });
    fireEvent.click(prevYearOption);

    await waitFor(() => {
      expect(fetchJson).toHaveBeenCalledWith(
        expect.stringContaining('comparison=previous_year')
      );
    });
  });

  it('adds custom compare dates when selecting custom comparison in ComparisonPicker', async () => {
    renderWithClient(<SalesPage />);
    await screen.findByText('$1,250.00');

    const compareTrigger = screen.getByRole('button', { name: /no comparison/i });
    fireEvent.click(compareTrigger);

    const customOption = screen.getByRole('menuitem', { name: /custom/i });
    fireEvent.click(customOption);

    const startInput = screen.getByLabelText(/compare start date/i);
    const endInput = screen.getByLabelText(/compare end date/i);

    fireEvent.change(startInput, { target: { value: '2025-01-01' } });
    fireEvent.change(endInput, { target: { value: '2025-01-31' } });

    const applyBtn = screen.getByRole('button', { name: /apply/i });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(fetchJson).toHaveBeenCalledWith(
        expect.stringContaining('comparison=custom&compare_start_date=2025-01-01&compare_end_date=2025-01-31')
      );
    });
  });

  it('does not render TrendBadge percentages when comparison_active is false', async () => {
    const mockWithoutComparison: DashboardSalesData = {
      ...mockData,
      range: {
        preset: 'last_30_days',
        start: '2026-08-16',
        end: '2026-09-14',
        label: 'Last 30 days',
        comparison_active: false,
      },
    };
    vi.mocked(fetchJson).mockResolvedValue({ data: mockWithoutComparison });

    renderWithClient(<SalesPage />);
    await screen.findByText('$1,250.00');

    expect(screen.queryByText('+15.2%')).not.toBeInTheDocument();
    expect(screen.queryByText('+8.5%')).not.toBeInTheDocument();
    expect(screen.queryByText('+6.1%')).not.toBeInTheDocument();
    expect(screen.queryByText('-1.5%')).not.toBeInTheDocument();
  });

  it('renders TrendBadge percentages when comparison_active is true', async () => {
    renderWithClient(<SalesPage />);
    await screen.findByText('$1,250.00');

    expect(screen.getByText('+15.2%')).toBeInTheDocument();
    expect(screen.getByText('+8.5%')).toBeInTheDocument();
    expect(screen.getByText('+6.1%')).toBeInTheDocument();
    expect(screen.getByText('-1.5%')).toBeInTheDocument();
  });

  it('renders dashed compare polylines when compare series are present, and omits them when absent', async () => {
    // 1. Initially absent in mockData
    const { unmount } = renderWithClient(<SalesPage />);
    await screen.findByText('$1,250.00');

    expect(screen.getByTestId('chart-revenue-primary')).toBeInTheDocument();
    expect(screen.getByTestId('chart-orders-primary')).toBeInTheDocument();
    expect(screen.queryByTestId('chart-revenue-compare')).not.toBeInTheDocument();
    expect(screen.queryByTestId('chart-orders-compare')).not.toBeInTheDocument();

    unmount();

    // 2. Present in mockWithCompare
    const mockWithCompare: DashboardSalesData = {
      ...mockData,
      sales_over_time: {
        ...mockData.sales_over_time,
        series: {
          ...mockData.sales_over_time.series,
          revenue_compare: [400.0, 310.0, 470.0],
          orders_compare: [8, 5, 9],
        },
      },
    };
    vi.mocked(fetchJson).mockResolvedValue({ data: mockWithCompare });

    renderWithClient(<SalesPage />);
    await screen.findByText('$1,250.00');

    expect(screen.getByTestId('chart-revenue-primary')).toBeInTheDocument();
    expect(screen.getByTestId('chart-orders-primary')).toBeInTheDocument();
    expect(screen.getByTestId('chart-revenue-compare')).toBeInTheDocument();
    expect(screen.getByTestId('chart-orders-compare')).toBeInTheDocument();
  });

  it('hides Yesterday option when primary range spans more than 1 day', async () => {
    renderWithClient(<SalesPage />);
    await screen.findByText('$1,250.00');

    // Default range is last_30_days (30 days > 1 day)
    const compareTrigger = screen.getByRole('button', { name: /no comparison/i });
    fireEvent.click(compareTrigger);

    expect(screen.queryByRole('menuitem', { name: /^yesterday$/i })).not.toBeInTheDocument();
  });

  it('auto-resets comparison from yesterday to none when primary range changes away from 1 day', async () => {
    renderWithClient(<SalesPage />);
    await screen.findByText('$1,250.00');

    // 1. Change range to 'today' (1 day) so allowYesterday becomes true
    const rangeTrigger = screen.getByRole('button', { name: /last 30 days/i });
    fireEvent.click(rangeTrigger);
    fireEvent.click(screen.getByRole('menuitem', { name: /^today$/i }));

    await waitFor(() => {
      expect(fetchJson).toHaveBeenCalledWith(
        expect.stringContaining('preset=today&comparison=none')
      );
    });

    // 2. Select 'yesterday' as comparison
    const compareTrigger = await screen.findByRole('button', { name: /no comparison/i });
    fireEvent.click(compareTrigger);
    const yesterdayOption = screen.getByRole('menuitem', { name: /^yesterday$/i });
    fireEvent.click(yesterdayOption);

    await waitFor(() => {
      expect(fetchJson).toHaveBeenCalledWith(
        expect.stringContaining('preset=today&comparison=yesterday')
      );
    });

    // 3. Switch date range back to last_30_days (span > 1 day)
    const todayTrigger = await screen.findByRole('button', { name: /^today$/i });
    fireEvent.click(todayTrigger);
    fireEvent.click(screen.getByRole('menuitem', { name: /^last$/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /^last 30 days$/i }));

    // 4. Assert next query resets comparison to none and does NOT contain comparison=yesterday
    await waitFor(() => {
      expect(fetchJson).toHaveBeenLastCalledWith(
        expect.stringContaining('preset=last_30_days&comparison=none')
      );
    });
    expect(fetchJson).not.toHaveBeenLastCalledWith(
      expect.stringContaining('comparison=yesterday')
    );
  });
});
