import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Activity, ShoppingCart, Star, UserPlus, type LucideIcon } from 'lucide-react';
import { useDashboardSales } from './api';
import { formatOrderAmount } from '@/features/orders/orderPresentation';
import { DateRangePicker, type DateRangeValue } from './DateRangePicker';
import {
  ComparisonPicker,
  formatComparisonLabel,
  type ComparisonValue,
} from './ComparisonPicker';

function activityIcon(icon: string): LucideIcon {
  switch (icon) {
    case 'shopping-cart':
      return ShoppingCart;
    case 'user-plus':
      return UserPlus;
    case 'star':
      return Star;
    default:
      return Activity;
  }
}

export function SalesPage() {
  const { t } = useTranslation();
  const [dateRange, setDateRange] = useState<DateRangeValue>({ preset: 'last_30_days' });
  const [comparison, setComparison] = useState<ComparisonValue>({ comparison: 'none' });

  const allowYesterday =
    dateRange.preset === 'today' ||
    (dateRange.preset === 'custom' &&
      !!dateRange.startDate &&
      dateRange.startDate === dateRange.endDate);

  useEffect(() => {
    if (comparison.comparison === 'yesterday' && !allowYesterday) {
      setComparison({ comparison: 'none' });
    }
  }, [allowYesterday, comparison]);

  const { data, isLoading, error } = useDashboardSales(dateRange, comparison);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {t('dashboard.error_loading', 'Failed to load dashboard data. Please try again.')}
        </div>
      </div>
    );
  }

  const { stats, returns_summary, sales_over_time, order_pipeline, top_products, sales_by_category, recent_orders, recent_activity, traffic_sources, goals } = data;

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Page Header & Range Switcher */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('dashboard.title', 'Sales Dashboard')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('dashboard.subtitle', 'Real-time performance and financial analytics')}</p>
        </div>

        {/* Range and Comparison Pickers */}
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <ComparisonPicker
            value={comparison}
            onChange={setComparison}
            allowYesterday={allowYesterday}
          />
        </div>
      </div>

      {/* Primary KPI Cards (4 columns) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Sales */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('dashboard.stats.sales', 'Total Sales')}</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              {formatOrderAmount(stats.sales.decimal, stats.sales.currency, false)}
            </span>
            <TrendBadge trend={stats.sales.trend} comparisonActive={data.range.comparison_active} />
          </div>
        </div>

        {/* Average Order Value */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('dashboard.stats.aov', 'Average Order Value')}</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              {formatOrderAmount(stats.aov.decimal, stats.aov.currency, false)}
            </span>
            <TrendBadge trend={stats.aov.trend} comparisonActive={data.range.comparison_active} />
          </div>
        </div>

        {/* Active Users (Honest placeholder) */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('dashboard.stats.active_users', 'Active Users')}</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-slate-400">
              {stats.active_users.formatted}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              {t('dashboard.stats.not_connected', 'Not connected')}
            </span>
          </div>
        </div>

        {/* Total Orders */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('dashboard.stats.orders', 'Total Orders')}</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              {stats.orders.count}
            </span>
            <TrendBadge trend={stats.orders.trend} comparisonActive={data.range.comparison_active} />
          </div>
        </div>
      </div>

      {/* Returns & Refunds Summary Strip */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-4">{t('dashboard.returns.heading', 'Returns & Refunds')}</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="border-r border-slate-100 last:border-0 pr-4">
            <span className="text-xs text-slate-500">{t('dashboard.returns.refund_rate', 'Refund Rate')}</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className={`text-xl font-bold ${returns_summary.refund_rate > 10 ? 'text-red-600' : 'text-amber-600'}`}>
                {returns_summary.refund_rate}%
              </span>
              <TrendBadge trend={returns_summary.refund_trend} comparisonActive={data.range.comparison_active} />
            </div>
          </div>
          <div className="border-r border-slate-100 last:border-0 pr-4">
            <span className="text-xs text-slate-500">{t('dashboard.returns.pending_review', 'Pending Review')}</span>
            <div className="mt-1">
              <span className="text-xl font-bold text-amber-600">{returns_summary.pending_review}</span>
            </div>
          </div>
          <div className="border-r border-slate-100 last:border-0 pr-4">
            <span className="text-xs text-slate-500">{t('dashboard.returns.overdue', 'Overdue Review')}</span>
            <div className="mt-1">
              <span className="text-xl font-bold text-red-600">{returns_summary.overdue}</span>
            </div>
          </div>
          <div>
            <span className="text-xs text-slate-500">{t('dashboard.returns.awaiting_completion', 'Awaiting Completion')}</span>
            <div className="mt-1">
              <span className="text-xl font-bold text-sky-600">{returns_summary.awaiting_completion}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Layout: 2 Columns */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Sales cards use a shared grid so paired cards align by row. */}
        <div className="contents">
          {/* Sales & Orders Over Time SVG Chart */}
          <div className="order-1 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="text-base font-bold text-slate-900">{t('dashboard.sales_overview', 'Sales Overview')}</h2>
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 font-medium text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#df8448]" />
                  {t('dashboard.revenue', 'Revenue')}
                </span>
                {data.range.comparison_active && (
                  <span className="flex items-center gap-1.5 font-medium text-slate-600 opacity-75">
                    <span className="h-1.5 w-3 border-t-2 border-dashed border-[#df8448]" />
                    {`${t('dashboard.revenue', 'Revenue')} (vs ${formatComparisonLabel(comparison, t)})`}
                  </span>
                )}
                <span className="flex items-center gap-1.5 font-medium text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#3e4c57]" />
                  {t('dashboard.orders', 'Orders')}
                </span>
                {data.range.comparison_active && (
                  <span className="flex items-center gap-1.5 font-medium text-slate-600 opacity-75">
                    <span className="h-1.5 w-3 border-t-2 border-dashed border-[#3e4c57]" />
                    {`${t('dashboard.orders', 'Orders')} (vs ${formatComparisonLabel(comparison, t)})`}
                  </span>
                )}
              </div>
            </div>
            <SalesSvgChart
              categories={sales_over_time.categories}
              revenue={sales_over_time.series.revenue}
              orders={sales_over_time.series.orders}
              revenueCompare={sales_over_time.series.revenue_compare}
              ordersCompare={sales_over_time.series.orders_compare}
            />
          </div>

          {/* Order Pipeline */}
          <div className="order-3 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm lg:col-span-2">
            <h2 className="text-base font-bold text-slate-900 mb-4">{t('dashboard.order_pipeline', 'Order Pipeline')}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <PipelineCard
                label={t('orders.statuses.awaiting_payment', 'Awaiting Payment')}
                count={order_pipeline.awaiting_payment}
                color="amber"
                icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
              <PipelineCard
                label={t('orders.statuses.processing', 'Processing')}
                count={order_pipeline.processing}
                color="blue"
                icon="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <PipelineCard
                label={t('orders.statuses.shipped', 'Shipped')}
                count={order_pipeline.shipped}
                color="purple"
                icon="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
              />
              <PipelineCard
                label={t('orders.statuses.delivered', 'Delivered')}
                count={order_pipeline.delivered}
                color="emerald"
                icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </div>
          </div>

          {/* Top Products Table */}
          <div className="order-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm lg:col-span-2">
            <h2 className="text-base font-bold text-slate-900 mb-4">{t('dashboard.top_products', 'Top Products')}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-semibold uppercase text-slate-500">
                    <th className="pb-3">{t('dashboard.product', 'Product')}</th>
                    <th className="pb-3">{t('dashboard.sku', 'SKU')}</th>
                    <th className="pb-3 text-right">{t('dashboard.units_sold', 'Sold')}</th>
                    <th className="pb-3 text-right">{t('dashboard.revenue', 'Revenue')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {top_products.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-slate-400">
                        {t('dashboard.no_products', 'No products found')}
                      </td>
                    </tr>
                  ) : (
                    top_products.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/50">
                        <td className="py-3 font-medium text-slate-900">{p.description}</td>
                        <td className="py-3 text-slate-500">{p.sku}</td>
                        <td className="py-3 text-right font-semibold text-slate-700">{p.quantity}</td>
                        <td className="py-3 text-right font-semibold text-[#df8448]">
                          {formatOrderAmount(p.revenue.decimal, p.revenue.currency, false)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Orders Table */}
          <div className="order-7 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900">{t('dashboard.recent_orders', 'Recent Orders')}</h2>
              <Link to="/orders" className="text-xs font-semibold text-[#df8448] hover:underline">
                {t('dashboard.view_all_orders', 'View all orders →')}
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-semibold uppercase text-slate-500">
                    <th className="pb-3">{t('dashboard.order', 'Order')}</th>
                    <th className="pb-3">{t('dashboard.customer', 'Customer')}</th>
                    <th className="pb-3">{t('dashboard.status', 'Status')}</th>
                    <th className="pb-3 text-right">{t('dashboard.total', 'Total')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {recent_orders.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-slate-400">
                        {t('dashboard.no_orders_yet', 'No orders placed yet')}
                      </td>
                    </tr>
                  ) : (
                    recent_orders.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-50/50">
                        <td className="py-3 font-semibold text-slate-900">
                          <Link to={`/orders/${o.id}`} className="hover:text-[#df8448] hover:underline">
                            {o.reference}
                          </Link>
                        </td>
                        <td className="py-3 text-slate-600">{o.customer_name}</td>
                        <td className="py-3">
                          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold capitalize text-slate-700">
                            {o.status}
                          </span>
                        </td>
                        <td className="py-3 text-right font-semibold text-slate-900">
                          {formatOrderAmount(o.total.decimal, o.total.currency, false)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="contents">
          {/* Goals Progress Card */}
          <div className="order-2 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900">{t('dashboard.monthly_goals', 'Monthly Goals')}</h2>
              <Link to="/goals" className="text-xs font-semibold text-[#df8448] hover:underline">
                {t('common.edit', 'Edit')}
              </Link>
            </div>
            <div className="space-y-5">
              {goals.map((g) => (
                <div key={g.key} className="space-y-1.5">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-semibold text-slate-700">{g.label}</span>
                    {g.percent !== null ? (
                      <span className="font-bold text-[#df8448]">{g.percent}%</span>
                    ) : (
                      <span className="text-xs text-slate-400">{t('dashboard.no_target', 'No target set')}</span>
                    )}
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[#df8448] transition-all"
                      style={{ width: `${g.percent ?? 0}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>
                      {g.unit === 'currency' ? formatOrderAmount(g.actual, data.currency, false) : g.actual}
                    </span>
                    {g.target !== null && (
                      <span>
                        {t('dashboard.target', 'Target')}: {g.unit === 'currency' ? formatOrderAmount(g.target, data.currency, false) : g.target}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sales By Category Bars */}
          <div className="order-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 mb-4">{t('dashboard.sales_by_category', 'Sales By Category')}</h2>
            {sales_by_category.length === 0 ? (
              <p className="text-sm text-slate-400">{t('dashboard.no_categories', 'No category sales')}</p>
            ) : (
              <div className="space-y-3">
                {sales_by_category.map((c) => {
                  const maxRevenue = Math.max(...sales_by_category.map((i) => i.revenue.decimal), 1);
                  const barPercent = Math.min(100, Math.round((c.revenue.decimal / maxRevenue) * 100));

                  return (
                    <div key={c.name} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium text-slate-700">
                        <span className="truncate pr-2">{c.name}</span>
                        <span className="font-semibold text-slate-900">
                          {formatOrderAmount(c.revenue.decimal, c.revenue.currency, false)}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-[#df8448]" style={{ width: `${barPercent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Traffic Sources (Honest placeholder) */}
          <div className="order-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900">{t('dashboard.traffic_sources', 'Traffic Sources')}</h2>
              <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                {t('dashboard.stats.not_connected', 'Not connected')}
              </span>
            </div>
            <div className="space-y-2.5">
              {traffic_sources.items.map((ts) => (
                <div key={ts.label} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ts.color }} />
                    <span className="text-slate-600">{ts.label}</span>
                  </div>
                  <span className="text-xs font-bold text-slate-400">—</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent System Activity */}
          <div className="order-8 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 mb-1">{t('dashboard.system_activity', 'Recent system activity')}</h2>
            <p className="text-xs text-slate-500 mb-4">{t('dashboard.system_activity_help', 'System-wide audit trail across operations')}</p>
            {recent_activity.length === 0 ? (
              <p className="text-sm text-slate-400">{t('dashboard.no_activity', 'No recent activity')}</p>
            ) : (
              <div className="space-y-3.5">
                {recent_activity.map((a, index) => {
                  const ActivityIcon = activityIcon(a.icon);

                  return (
                    <div key={index} className="flex items-start gap-3">
                      <div
                        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
                        style={{ backgroundColor: a.color }}
                      >
                        <ActivityIcon aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.25} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-800">{a.title}</p>
                        <p className="text-xs text-slate-500 truncate">{a.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TrendBadge({ trend, comparisonActive }: { trend: number; comparisonActive: boolean }) {
  if (!comparisonActive) return null;
  const isPositive = trend >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
      {isPositive ? '+' : ''}{trend}%
    </span>
  );
}

function PipelineCard({ label, count, color, icon }: { label: string; count: number; color: string; icon: string }) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    amber: { bg: 'bg-amber-50', text: 'text-amber-600' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-600' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-600' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  };

  const c = colorMap[color] || colorMap.blue;

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-600 truncate">{label}</span>
        <div className={`flex h-6 w-6 items-center justify-center rounded-lg ${c.bg} ${c.text}`}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={icon} />
          </svg>
        </div>
      </div>
      <div className="mt-2 text-xl font-bold text-slate-900">{count}</div>
    </div>
  );
}

function SalesSvgChart({
  categories,
  revenue,
  orders,
  revenueCompare,
  ordersCompare,
}: {
  categories: string[];
  revenue: number[];
  orders: number[];
  revenueCompare?: number[];
  ordersCompare?: number[];
}) {
  if (categories.length === 0) {
    return <div className="h-64 flex items-center justify-center text-slate-400 text-sm">No data available</div>;
  }

  const width = 600;
  const height = 240;
  const padding = 40;

  const maxRevenue = Math.max(...revenue, ...(revenueCompare ?? []), 100);
  const maxOrders = Math.max(...orders, ...(ordersCompare ?? []), 10);

  const getX = (index: number) => padding + (index * (width - 2 * padding)) / Math.max(categories.length - 1, 1);
  const getYRevenue = (val: number) => height - padding - (val / maxRevenue) * (height - 2 * padding);
  const getYOrders = (val: number) => height - padding - (val / maxOrders) * (height - 2 * padding);

  const revenuePoints = revenue.map((val, i) => `${getX(i)},${getYRevenue(val)}`).join(' ');
  const ordersPoints = orders.map((val, i) => `${getX(i)},${getYOrders(val)}`).join(' ');

  const hasRevenueCompare = !!revenueCompare && revenueCompare.length > 0;
  const hasOrdersCompare = !!ordersCompare && ordersCompare.length > 0;

  const revenueComparePoints = hasRevenueCompare
    ? revenueCompare.map((val, i) => `${getX(i)},${getYRevenue(val)}`).join(' ')
    : '';
  const ordersComparePoints = hasOrdersCompare
    ? ordersCompare.map((val, i) => `${getX(i)},${getYOrders(val)}`).join(' ')
    : '';

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-64 overflow-visible">
        {/* Grid lines */}
        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#f1f5f9" strokeWidth="1" />
        <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="#f1f5f9" strokeWidth="1" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#cbd5e1" strokeWidth="1" />

        {/* Primary Revenue Line */}
        <polyline fill="none" stroke="#df8448" strokeWidth="3" strokeLinecap="round" points={revenuePoints} data-testid="chart-revenue-primary" />

        {/* Primary Orders Line */}
        <polyline fill="none" stroke="#3e4c57" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" points={ordersPoints} data-testid="chart-orders-primary" />

        {/* Compare Revenue Line */}
        {hasRevenueCompare && (
          <polyline
            fill="none"
            stroke="#df8448"
            strokeWidth="2"
            strokeDasharray="4 4"
            opacity="0.5"
            strokeLinecap="round"
            points={revenueComparePoints}
            data-testid="chart-revenue-compare"
          />
        )}

        {/* Compare Orders Line */}
        {hasOrdersCompare && (
          <polyline
            fill="none"
            stroke="#3e4c57"
            strokeWidth="2"
            strokeDasharray="4 4"
            opacity="0.5"
            strokeLinecap="round"
            points={ordersComparePoints}
            data-testid="chart-orders-compare"
          />
        )}

        {/* Categories X axis labels */}
        {categories.map((cat, i) => {
          if (categories.length > 15 && i % Math.ceil(categories.length / 10) !== 0) return null;
          return (
            <text key={i} x={getX(i)} y={height - 15} fontSize="10" fill="#94a3b8" textAnchor="middle">
              {cat}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
