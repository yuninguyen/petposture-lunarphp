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
  range: '30',
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
  });

  it('renders goal progress bars and target indicators', async () => {
    renderWithClient(<SalesPage />);

    expect(await screen.findByText('Monthly Revenue Target')).toBeInTheDocument();
    expect(screen.getByText('65%')).toBeInTheDocument();
    expect(screen.getByText(/Target: \$2,000/i)).toBeInTheDocument();
    expect(screen.getByText('No target set')).toBeInTheDocument();
  });

  it('switches ranges when range tabs are clicked', async () => {
    renderWithClient(<SalesPage />);

    await screen.findByText('$1,250.00');
    const day7Tab = screen.getByRole('button', { name: /7 days/i });
    fireEvent.click(day7Tab);

    await waitFor(() => {
      expect(fetchJson).toHaveBeenCalledWith(expect.stringContaining('range=7'));
    });
  });
});
