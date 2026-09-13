import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '@/lib/api';

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

export interface DashboardSalesData {
  range: string;
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

export async function fetchDashboardSales(range = '30'): Promise<DashboardSalesData> {
  const res = await fetchJson<{ data: DashboardSalesData }>(`/admin/dashboard/sales?range=${encodeURIComponent(range)}`);
  return res.data;
}

export function useDashboardSales(range = '30') {
  return useQuery({
    queryKey: ['dashboard-sales', range],
    queryFn: () => fetchDashboardSales(range),
  });
}
