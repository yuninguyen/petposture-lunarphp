import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '@/lib/api';
import type { DateRangeValue } from './DateRangePicker';
import type { ComparisonValue } from './ComparisonPicker';

export interface DashboardMoney {
  raw: number;
  decimal: number;
  currency: string;
}

export interface DashboardStats {
  sales: {
    raw: number;
    decimal: number;
    currency: string;
    trend: number;
  };
  orders: {
    count: number;
    trend: number;
  };
  aov: {
    raw: number;
    decimal: number;
    currency: string;
    trend: number;
  };
  active_users: {
    value: number | null;
    status: string;
    formatted: string;
  };
}

export interface ReturnsSummary {
  refund_rate: number;
  refund_trend: number;
  pending_review: number;
  overdue: number;
  awaiting_completion: number;
}

export interface SalesOverTime {
  granularity: 'day' | 'month';
  categories: string[];
  series: {
    revenue: number[];
    orders: number[];
    revenue_compare?: number[];
    orders_compare?: number[];
  };
}

export interface OrderPipeline {
  awaiting_payment: number;
  processing: number;
  shipped: number;
  delivered: number;
}

export interface TopProduct {
  id: number;
  description: string;
  sku: string;
  quantity: number;
  revenue: DashboardMoney;
}

export interface CategorySales {
  name: string;
  revenue: DashboardMoney;
}

export interface RecentOrder {
  id: number;
  reference: string;
  customer_name: string;
  status: string;
  total: DashboardMoney;
  placed_at: string | null;
  created_at: string | null;
}

export interface RecentActivityEvent {
  icon: string;
  color: string;
  title: string;
  description: string;
  at: string;
}

export interface TrafficSourceItem {
  label: string;
  percent: number | null;
  color: string;
}

export interface TrafficSources {
  status: string;
  items: TrafficSourceItem[];
}

export interface GoalProgressItem {
  key: string;
  label: string;
  actual: number;
  target: number | null;
  percent: number | null;
  uncapped_percent: number | null;
  unit: 'currency' | 'number';
}

export interface DashboardRangeInfo {
  preset: string;
  start: string;
  end: string;
  label: string;
  comparison_active: boolean;
}

export interface DashboardSalesData {
  range: DashboardRangeInfo;
  currency: string;
  stats: DashboardStats;
  returns_summary: ReturnsSummary;
  sales_over_time: SalesOverTime;
  order_pipeline: OrderPipeline;
  top_products: TopProduct[];
  sales_by_category: CategorySales[];
  recent_orders: RecentOrder[];
  recent_activity: RecentActivityEvent[];
  traffic_sources: TrafficSources;
  goals: GoalProgressItem[];
}

function buildSalesQuery(dateRange: DateRangeValue, comparison: ComparisonValue): string {
  const params = new URLSearchParams();
  params.set('preset', dateRange.preset);
  if (dateRange.preset === 'quarter' && dateRange.quarter) params.set('quarter', dateRange.quarter);
  if (dateRange.preset === 'custom') {
    if (dateRange.startDate) params.set('start_date', dateRange.startDate);
    if (dateRange.endDate) params.set('end_date', dateRange.endDate);
  }
  params.set('comparison', comparison.comparison);
  if (comparison.comparison === 'custom') {
    params.set('compare_start_date', comparison.compareStartDate);
    params.set('compare_end_date', comparison.compareEndDate);
  }
  return params.toString();
}

export async function fetchDashboardSales(
  dateRange: DateRangeValue,
  comparison: ComparisonValue
): Promise<DashboardSalesData> {
  const res = await fetchJson<{ data: DashboardSalesData }>(
    `/admin/dashboard/sales?${buildSalesQuery(dateRange, comparison)}`
  );
  return res.data;
}

export function useDashboardSales(
  dateRange: DateRangeValue,
  comparison: ComparisonValue
) {
  return useQuery({
    queryKey: ['dashboard-sales', dateRange, comparison],
    queryFn: () => fetchDashboardSales(dateRange, comparison),
  });
}

export interface ConversionRangeInfo {
  preset: string;
  start: string;
  end: string;
  label: string;
}

export interface ConversionData {
  range: ConversionRangeInfo;
  carts_created: number;
  checkouts_started: number;
  orders_completed: number;
  cart_abandonment_rate: number;
  checkout_abandonment_rate: number;
}

function buildConversionQuery(dateRange: DateRangeValue): string {
  const params = new URLSearchParams();
  params.set('preset', dateRange.preset);
  if (dateRange.preset === 'quarter' && dateRange.quarter) params.set('quarter', dateRange.quarter);
  if (dateRange.preset === 'custom') {
    if (dateRange.startDate) params.set('start_date', dateRange.startDate);
    if (dateRange.endDate) params.set('end_date', dateRange.endDate);
  }
  return params.toString();
}

export async function fetchConversion(dateRange: DateRangeValue): Promise<ConversionData> {
  const res = await fetchJson<{ data: ConversionData }>(
    `/admin/dashboard/conversion?${buildConversionQuery(dateRange)}`
  );
  return res.data;
}

export function useConversion(dateRange: DateRangeValue) {
  return useQuery({
    queryKey: ['dashboard-conversion', dateRange],
    queryFn: () => fetchConversion(dateRange),
  });
}

