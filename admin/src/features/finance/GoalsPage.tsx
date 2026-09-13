import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Target, DollarSign, ShoppingCart, Users, CheckCircle2 } from 'lucide-react';
import { useGoals, useUpdateGoals, type GoalItem } from './goalsApi';
import { formatOrderAmount } from '@/features/orders/orderPresentation';
import { Button } from '@/components/ui/button';

export function GoalsPage() {
  const { t } = useTranslation();
  const { data, isLoading, isError, error } = useGoals();
  const updateMutation = useUpdateGoals();

  const [revenueTarget, setRevenueTarget] = useState<string>('');
  const [ordersTarget, setOrdersTarget] = useState<string>('');
  const [customersTarget, setCustomersTarget] = useState<string>('');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (data?.data?.goals) {
      for (const goal of data.data.goals) {
        if (goal.key === 'monthly_revenue_target') {
          setRevenueTarget(goal.target !== null ? String(goal.target) : '');
        } else if (goal.key === 'monthly_orders_target') {
          setOrdersTarget(goal.target !== null ? String(goal.target) : '');
        } else if (goal.key === 'monthly_new_customers_target') {
          setCustomersTarget(goal.target !== null ? String(goal.target) : '');
        }
      }
    }
  }, [data]);

  if (isLoading) {
    return (
      <div role="status" className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
        <p className="font-medium">{t('goals.error_loading', 'Failed to load goals data.')}</p>
        <p className="text-sm mt-1">{(error as Error)?.message}</p>
      </div>
    );
  }

  const goalsList: GoalItem[] = data?.data?.goals ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setGeneralError(null);
    setSuccessMessage(null);

    const payload = {
      monthly_revenue_target: revenueTarget.trim() === '' ? null : Number(revenueTarget),
      monthly_orders_target: ordersTarget.trim() === '' ? null : parseInt(ordersTarget, 10),
      monthly_new_customers_target: customersTarget.trim() === '' ? null : parseInt(customersTarget, 10),
    };

    try {
      await updateMutation.mutateAsync(payload);
      toast.success(t('goals.save_success', 'Goals updated successfully'));
      setSuccessMessage(t('goals.save_success', 'Goals updated successfully'));
    } catch (err: unknown) {
      const apiErr = err as { status?: number; data?: { message?: string; errors?: Record<string, string[]> } };
      if (apiErr.data?.errors) {
        const mapped: Record<string, string> = {};
        for (const [key, messages] of Object.entries(apiErr.data.errors)) {
          if (Array.isArray(messages) && messages.length > 0) {
            mapped[key] = messages[0];
          }
        }
        setFieldErrors(mapped);
      }
      const msg = apiErr.data?.message || (err as Error)?.message || t('goals.save_failed', 'Failed to update goals.');
      setGeneralError(msg);
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {t('goals.title', 'Monthly Goals')}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {t('goals.subtitle', 'Set performance benchmarks for revenue, orders, and customer acquisition')}
        </p>
      </div>

      {generalError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {generalError}
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form settings */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-100">
            <Target className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-slate-900">
              {t('goals.targets_configuration', 'Targets Configuration')}
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Revenue Target */}
            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="monthly_revenue_target"
                  className="block text-sm font-medium text-slate-700"
                >
                  {t('goals.fields.revenue_target', 'Monthly Revenue Target')}
                </label>
                {revenueTarget && (
                  <button
                    type="button"
                    onClick={() => setRevenueTarget('')}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    {t('goals.actions.clear', 'Clear')}
                  </button>
                )}
              </div>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <DollarSign className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  id="monthly_revenue_target"
                  type="number"
                  step="any"
                  min="0"
                  placeholder={t('goals.placeholders.unconfigured', 'Leave empty to clear')}
                  value={revenueTarget}
                  onChange={(e) => setRevenueTarget(e.target.value)}
                  className={`block w-full rounded-lg border pl-9 pr-3 py-2 text-sm transition-colors focus:outline-none focus:ring-1 ${
                    fieldErrors.monthly_revenue_target
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500 bg-red-50/20'
                      : 'border-slate-300 focus:border-primary focus:ring-primary'
                  }`}
                />
              </div>
              {fieldErrors.monthly_revenue_target ? (
                <p className="mt-1.5 text-xs text-red-600" data-testid="error-revenue">
                  {fieldErrors.monthly_revenue_target}
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-400">
                  {t('goals.help.revenue_target', 'Target gross sales in base currency for the current calendar month.')}
                </p>
              )}
            </div>

            {/* Orders Target */}
            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="monthly_orders_target"
                  className="block text-sm font-medium text-slate-700"
                >
                  {t('goals.fields.orders_target', 'Monthly Orders Target')}
                </label>
                {ordersTarget && (
                  <button
                    type="button"
                    onClick={() => setOrdersTarget('')}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    {t('goals.actions.clear', 'Clear')}
                  </button>
                )}
              </div>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <ShoppingCart className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  id="monthly_orders_target"
                  type="number"
                  step="1"
                  min="0"
                  placeholder={t('goals.placeholders.unconfigured', 'Leave empty to clear')}
                  value={ordersTarget}
                  onChange={(e) => setOrdersTarget(e.target.value)}
                  className={`block w-full rounded-lg border pl-9 pr-3 py-2 text-sm transition-colors focus:outline-none focus:ring-1 ${
                    fieldErrors.monthly_orders_target
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500 bg-red-50/20'
                      : 'border-slate-300 focus:border-primary focus:ring-primary'
                  }`}
                />
              </div>
              {fieldErrors.monthly_orders_target ? (
                <p className="mt-1.5 text-xs text-red-600" data-testid="error-orders">
                  {fieldErrors.monthly_orders_target}
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-400">
                  {t('goals.help.orders_target', 'Target number of non-cancelled orders for the current month.')}
                </p>
              )}
            </div>

            {/* Customers Target */}
            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="monthly_new_customers_target"
                  className="block text-sm font-medium text-slate-700"
                >
                  {t('goals.fields.customers_target', 'Monthly New Customers Target')}
                </label>
                {customersTarget && (
                  <button
                    type="button"
                    onClick={() => setCustomersTarget('')}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    {t('goals.actions.clear', 'Clear')}
                  </button>
                )}
              </div>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Users className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  id="monthly_new_customers_target"
                  type="number"
                  step="1"
                  min="0"
                  placeholder={t('goals.placeholders.unconfigured', 'Leave empty to clear')}
                  value={customersTarget}
                  onChange={(e) => setCustomersTarget(e.target.value)}
                  className={`block w-full rounded-lg border pl-9 pr-3 py-2 text-sm transition-colors focus:outline-none focus:ring-1 ${
                    fieldErrors.monthly_new_customers_target
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500 bg-red-50/20'
                      : 'border-slate-300 focus:border-primary focus:ring-primary'
                  }`}
                />
              </div>
              {fieldErrors.monthly_new_customers_target ? (
                <p className="mt-1.5 text-xs text-red-600" data-testid="error-customers">
                  {fieldErrors.monthly_new_customers_target}
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-400">
                  {t('goals.help.customers_target', 'Target new customer registrations for the current month.')}
                </p>
              )}
            </div>

            <div className="pt-4 flex items-center justify-end">
              <Button type="submit" variant="primary" disabled={updateMutation.isPending}>
                {updateMutation.isPending
                  ? t('goals.actions.saving', 'Saving...')
                  : t('goals.actions.save', 'Save Goals')}
              </Button>
            </div>
          </form>
        </div>

        {/* Current Month Progress */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <h2 className="text-lg font-semibold text-slate-900 pb-4 border-b border-slate-100">
            {t('goals.current_month_progress', 'Current Month Progress')}
          </h2>

          <div className="space-y-6">
            {goalsList.map((goal) => {
              const actualFormatted =
                goal.unit === 'currency'
                  ? formatOrderAmount(goal.actual, 'USD')
                  : goal.actual.toLocaleString();

              const targetFormatted =
                goal.target !== null
                  ? goal.unit === 'currency'
                    ? formatOrderAmount(goal.target, 'USD')
                    : goal.target.toLocaleString()
                  : null;

              return (
                <div key={goal.key} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{goal.label}</span>
                    <span className="text-slate-500 font-mono text-xs">
                      {goal.uncapped_percent !== null ? `${goal.uncapped_percent}%` : ''}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between text-xs text-slate-500">
                    <div>
                      <span className="text-slate-400">{t('goals.actual', 'Actual')}: </span>
                      <span className="font-semibold text-slate-800">{actualFormatted}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">{t('goals.target', 'Target')}: </span>
                      <span className="font-semibold text-slate-800">
                        {targetFormatted ?? t('goals.no_target', 'No target set')}
                      </span>
                    </div>
                  </div>

                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        (goal.uncapped_percent ?? 0) >= 100
                          ? 'bg-emerald-500'
                          : 'bg-primary'
                      }`}
                      style={{ width: `${Math.min(100, goal.percent ?? 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
