import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useConversion } from './api';
import { DateRangePicker, type DateRangeValue } from './DateRangePicker';

export function ConversionPage() {
  const { t } = useTranslation();
  const [dateRange, setDateRange] = useState<DateRangeValue>({ preset: 'last_30_days' });
  const { data, isLoading, error } = useConversion(dateRange);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {t('conversion.error_loading', 'Failed to load conversion data. Please try again.')}
        </div>
      </div>
    );
  }

  const {
    carts_created,
    checkouts_started,
    orders_completed,
    cart_abandonment_rate,
    checkout_abandonment_rate,
  } = data;

  const cartDropoffCount = Math.max(0, carts_created - checkouts_started);
  const checkoutDropoffCount = Math.max(0, checkouts_started - orders_completed);

  const cartToCheckoutPercent = carts_created > 0
    ? Math.min(100, Math.round((checkouts_started / carts_created) * 1000) / 10)
    : 0;

  const checkoutToOrderPercent = checkouts_started > 0
    ? Math.min(100, Math.round((orders_completed / checkouts_started) * 1000) / 10)
    : 0;

  const overallConversionPercent = carts_created > 0
    ? Math.min(100, Math.round((orders_completed / carts_created) * 1000) / 10)
    : 0;

  const cartAbandonmentPercent = (cart_abandonment_rate * 100).toFixed(1);
  const checkoutAbandonmentPercent = (checkout_abandonment_rate * 100).toFixed(1);

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Page Header & Range Switcher */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {t('conversion.title', 'Online Store Conversion')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {t('conversion.subtitle', 'Track your conversion funnel from carts to completed orders')}
          </p>
        </div>

        {/* Date Range Picker */}
        <div>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {/* Primary KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Stage 1: Carts Created */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t('conversion.carts_created', 'Carts Created')}
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-slate-900" data-testid="carts-created-count">
              {carts_created.toLocaleString()}
            </span>
            <span className="text-xs font-medium text-slate-500">
              {t('conversion.funnel_step', 'Step')} 1
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {t('conversion.carts_created_desc', 'Total shopping carts created in this period')}
          </p>
        </div>

        {/* Stage 2: Checkouts Started */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t('conversion.checkouts_started', 'Checkouts Started')}
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-slate-900" data-testid="checkouts-started-count">
              {checkouts_started.toLocaleString()}
            </span>
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
              {cartToCheckoutPercent}%
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {t('conversion.checkouts_started_desc', 'Sessions that proceeded past the initial cart')}
          </p>
        </div>

        {/* Stage 3: Orders Completed */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t('conversion.orders_completed', 'Orders Completed')}
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-slate-900" data-testid="orders-completed-count">
              {orders_completed.toLocaleString()}
            </span>
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              {checkoutToOrderPercent}%
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {t('conversion.orders_completed_desc', 'Orders successfully placed (excluding cancelled)')}
          </p>
        </div>
      </div>

      {/* Funnel Flow Visualization */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900">
            {t('conversion.funnel_title', 'Conversion Funnel')}
          </h2>
          <div className="mt-1 sm:mt-0 flex items-center gap-2">
            <span className="text-xs text-slate-500">
              {t('conversion.overall_conversion', 'Overall Conversion Rate')}:
            </span>
            <span className="text-sm font-bold text-emerald-600" data-testid="overall-conversion-rate">
              {overallConversionPercent}%
            </span>
          </div>
        </div>

        {/* Funnel Progression Bars */}
        <div className="space-y-4">
          {/* Stage 1: Cart */}
          <div>
            <div className="flex justify-between text-xs font-medium text-slate-600 mb-1">
              <span>1. {t('conversion.carts_created', 'Carts Created')}</span>
              <span className="font-semibold text-slate-900">{carts_created.toLocaleString()} (100%)</span>
            </div>
            <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full bg-indigo-500 transition-all duration-500" style={{ width: '100%' }} />
            </div>
          </div>

          {/* Drop-off 1 */}
          <div className="flex items-center gap-2 pl-4 py-1 text-xs text-rose-600 bg-rose-50/50 rounded-lg border border-rose-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            <span>
              {t('conversion.drop_off', 'Drop-off')}: <strong data-testid="cart-dropoff-count">{cartDropoffCount.toLocaleString()}</strong> carts ({cartAbandonmentPercent}%)
            </span>
          </div>

          {/* Stage 2: Checkout */}
          <div>
            <div className="flex justify-between text-xs font-medium text-slate-600 mb-1">
              <span>2. {t('conversion.checkouts_started', 'Checkouts Started')}</span>
              <span className="font-semibold text-slate-900">
                {checkouts_started.toLocaleString()} ({cartToCheckoutPercent}%)
              </span>
            </div>
            <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-500 transition-all duration-500"
                style={{ width: `${cartToCheckoutPercent}%` }}
              />
            </div>
          </div>

          {/* Drop-off 2 */}
          <div className="flex items-center gap-2 pl-4 py-1 text-xs text-rose-600 bg-rose-50/50 rounded-lg border border-rose-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            <span>
              {t('conversion.drop_off', 'Drop-off')}: <strong data-testid="checkout-dropoff-count">{checkoutDropoffCount.toLocaleString()}</strong> checkouts ({checkoutAbandonmentPercent}%)
            </span>
          </div>

          {/* Stage 3: Orders */}
          <div>
            <div className="flex justify-between text-xs font-medium text-slate-600 mb-1">
              <span>3. {t('conversion.orders_completed', 'Orders Completed')}</span>
              <span className="font-semibold text-slate-900">
                {orders_completed.toLocaleString()} ({overallConversionPercent}%)
              </span>
            </div>
            <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${overallConversionPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Distinct Drop-off / Abandonment Rate Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Cart Abandonment Rate */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t('conversion.cart_abandonment', 'Cart Abandonment Rate')}
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-slate-900" data-testid="cart-abandonment-rate">
              {cartAbandonmentPercent}%
            </span>
            <span className="text-xs text-slate-500">
              {cartDropoffCount.toLocaleString()} {t('conversion.carts_created', 'Carts Created').toLowerCase()}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {t('conversion.cart_abandonment_desc', 'Carts that never started checkout')}
          </p>
        </div>

        {/* Checkout Abandonment Rate */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t('conversion.checkout_abandonment', 'Checkout Abandonment Rate')}
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-slate-900" data-testid="checkout-abandonment-rate">
              {checkoutAbandonmentPercent}%
            </span>
            <span className="text-xs text-slate-500">
              {checkoutDropoffCount.toLocaleString()} {t('conversion.checkouts_started', 'Checkouts Started').toLowerCase()}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {t('conversion.checkout_abandonment_desc', 'Checkouts that did not result in a completed order')}
          </p>
        </div>
      </div>
    </div>
  );
}
