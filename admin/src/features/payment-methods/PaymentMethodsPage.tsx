import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Badge, type BadgeColor } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  fetchPaymentMethods,
  refreshAirwallexSync,
  refreshStripeSync,
  updateCardBrands,
  updateCheckoutPaymentMethod,
  updateCodPaymentMethod,
  type CheckoutPaymentMethodState,
  type PaymentGateway,
  type PaymentMethodState,
  type PaymentMethodsResponse,
  type StripeStatus,
} from './api';
import { GatewayForm } from './GatewayForm';
import { MethodLogo } from './methodLogos';

const QUERY_KEY = ['admin', 'payment-methods'] as const;
const APPROVED_GATEWAYS: PaymentGateway[] = ['stripe', 'paypal', 'airwallex', 'payoneer'];
const STRIPE_STATUS_COLORS: Record<StripeStatus, BadgeColor> = { on: 'emerald', off: 'red', unavailable: 'amber' };

function replaceGateway(current: PaymentMethodsResponse | undefined, next: PaymentMethodState): PaymentMethodsResponse | undefined {
  if (!current) return current;
  return { ...current, data: current.data.map((gateway) => gateway.gateway === next.gateway ? next : gateway) };
}

function replaceMethod(current: PaymentMethodsResponse | undefined, next: CheckoutPaymentMethodState): PaymentMethodsResponse | undefined {
  if (!current) return current;
  // Replace in place: filter-then-append would push the toggled row to the end of its group.
  return { ...current, methods: (current.methods ?? []).map((method) => method.method === next.method ? next : method) };
}

export function PaymentMethodsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const paymentMethodsQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchPaymentMethods,
  });
  const codMutation = useMutation({
    mutationFn: updateCodPaymentMethod,
    onSuccess: (result) => queryClient.setQueryData<PaymentMethodsResponse>(QUERY_KEY, (current) => current && { ...current, cod: result.data }),
  });
  const codEnabled = paymentMethodsQuery.data?.cod.enabled ?? true;
  const methodMutation = useMutation({
    mutationFn: ({ method, enabled }: { method: string; enabled: boolean }) => updateCheckoutPaymentMethod(method, enabled),
    onSuccess: (result) => queryClient.setQueryData<PaymentMethodsResponse>(QUERY_KEY, (current) => replaceMethod(current, result.data)),
  });
  const brandsMutation = useMutation({
    mutationFn: ({ brands, gateway }: { brands: string[]; gateway?: 'airwallex' }) => updateCardBrands(brands, gateway),
    onSuccess: (result, { gateway }) => queryClient.setQueryData<PaymentMethodsResponse>(
      QUERY_KEY,
      (current) => current && { ...current, [gateway === 'airwallex' ? 'airwallex_card_brands' : 'card_brands']: result.data },
    ),
  });
  const syncMutation = useMutation({
    mutationFn: refreshStripeSync,
    onSuccess: (result) => queryClient.setQueryData<PaymentMethodsResponse>(QUERY_KEY, (current) => current && { ...current, methods: result.data.methods, stripe_sync: result.data.stripe_sync }),
  });
  const airwallexSyncMutation = useMutation({
    mutationFn: refreshAirwallexSync,
    onSuccess: (result) => queryClient.setQueryData<PaymentMethodsResponse>(QUERY_KEY, (current) => current && { ...current, methods: result.data.methods, airwallex_sync: result.data.airwallex_sync }),
  });
  const gateways = useMemo(() => {
    const byGateway = new Map<PaymentGateway, PaymentMethodState>();
    for (const gateway of paymentMethodsQuery.data?.data ?? []) {
      if (APPROVED_GATEWAYS.includes(gateway.gateway) && !byGateway.has(gateway.gateway)) {
        byGateway.set(gateway.gateway, gateway);
      }
    }
    return APPROVED_GATEWAYS.flatMap((gateway) => {
      const state = byGateway.get(gateway);
      return state ? [state] : [];
    });
  }, [paymentMethodsQuery.data]);
  const [selectedGateway, setSelectedGateway] = useState<PaymentGateway>('stripe');
  // The selected gateway's own checkout methods (COD keeps its dedicated switch below).
  const selectedMethods = useMemo(
    () => (paymentMethodsQuery.data?.methods ?? []).filter((method) => method.gateway === selectedGateway && method.method !== 'cod'),
    [paymentMethodsQuery.data?.methods, selectedGateway],
  );
  const cardBrands = paymentMethodsQuery.data?.card_brands;
  const airwallexCardBrands = paymentMethodsQuery.data?.airwallex_card_brands;
  // Gateways whose method states are read (read-only) from the provider's own API.
  const syncByGateway = {
    stripe: { sync: paymentMethodsQuery.data?.stripe_sync, mutation: syncMutation, prefix: 'stripe' },
    airwallex: { sync: paymentMethodsQuery.data?.airwallex_sync, mutation: airwallexSyncMutation, prefix: 'airwallex' },
  } as const;
  const [copyStatus, setCopyStatus] = useState<'copied' | 'error' | null>(null);

  useEffect(() => {
    if (gateways.length > 0 && !gateways.some((gateway) => gateway.gateway === selectedGateway)) {
      setSelectedGateway(gateways[0].gateway);
    }
  }, [gateways, selectedGateway]);

  useEffect(() => {
    setCopyStatus(null);
  }, [selectedGateway]);

  if (paymentMethodsQuery.isLoading) {
    return <p role="status" className="p-8 text-sm text-slate-500">{t('payment_methods.loading', { defaultValue: 'Loading payment methods…' })}</p>;
  }

  if (paymentMethodsQuery.isError) {
    return (
      <p role="alert" className="p-8 text-sm text-red-600">
        {t('payment_methods.error', { defaultValue: 'Payment methods could not be loaded.' })}
      </p>
    );
  }

  if (gateways.length === 0) {
    return <p role="status" className="p-8 text-sm text-slate-500">{t('payment_methods.empty', { defaultValue: 'No payment methods are available.' })}</p>;
  }

  const selected = gateways.find((gateway) => gateway.gateway === selectedGateway) ?? gateways[0];
  const gatewayLabel = (gateway: PaymentGateway) => t(`payment_methods.gateways.${gateway}`, { defaultValue: gateway });
  const sourceLabel = (source: PaymentMethodState['source']) => ({
    database: t('payment_methods.source.database', { defaultValue: 'Database' }),
    environment: t('payment_methods.source.environment', { defaultValue: 'Environment' }),
    mixed: t('payment_methods.source.mixed', { defaultValue: 'Mixed' }),
    none: t('payment_methods.source.none', { defaultValue: 'None' }),
  })[source];
  const enabledLabel = t('payment_methods.checkout_methods.enabled', { defaultValue: 'Enabled' });
  const disabledLabel = t('payment_methods.checkout_methods.disabled', { defaultValue: 'Disabled' });
  const providerStatusLabel = (provider: 'stripe' | 'airwallex', status: StripeStatus) => ({
    stripe: {
      on: t('payment_methods.stripe_status.on', { defaultValue: 'On in Stripe' }),
      off: t('payment_methods.stripe_status.off', { defaultValue: 'Off in Stripe' }),
      unavailable: t('payment_methods.stripe_status.unavailable', { defaultValue: 'Not available in Stripe' }),
    },
    airwallex: {
      on: t('payment_methods.airwallex_status.on', { defaultValue: 'On in Airwallex' }),
      off: t('payment_methods.airwallex_status.off', { defaultValue: 'Off in Airwallex' }),
      unavailable: t('payment_methods.airwallex_status.unavailable', { defaultValue: 'Not active in Airwallex' }),
    },
  })[provider][status];
  const providerSync = selected.gateway === 'stripe' || selected.gateway === 'airwallex' ? syncByGateway[selected.gateway] : null;

  async function copyWebhookUrl() {
    setCopyStatus(null);
    try {
      await navigator.clipboard.writeText(selected.webhook_url);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {t('payment_methods.title', { defaultValue: 'Payment methods' })}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {t('payment_methods.subtitle', { defaultValue: 'Configure and verify checkout payment providers.' })}
        </p>
      </header>

      <label className="block md:hidden">
        <span className="mb-2 block text-sm font-medium text-slate-700">
          {t('payment_methods.gateway', { defaultValue: 'Payment gateway' })}
        </span>
        <select
          aria-label={t('payment_methods.gateway', { defaultValue: 'Payment gateway' })}
          value={selected.gateway}
          onChange={(event) => setSelectedGateway(event.target.value as PaymentGateway)}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
        >
          {gateways.map((gateway) => <option key={gateway.gateway} value={gateway.gateway}>{gatewayLabel(gateway.gateway)}</option>)}
        </select>
      </label>

      <div className="hidden grid-cols-2 gap-3 md:grid lg:grid-cols-4" aria-label={t('payment_methods.gateway', { defaultValue: 'Payment gateway' })}>
        {gateways.map((gateway) => (
          <button
            key={gateway.gateway}
            type="button"
            data-testid="gateway-selector"
            aria-pressed={gateway.gateway === selected.gateway}
            onClick={() => setSelectedGateway(gateway.gateway)}
            className={`rounded-xl border p-4 text-left transition-colors ${gateway.gateway === selected.gateway ? 'border-secondary bg-secondary/5' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
          >
            <span className="block font-semibold text-slate-900">{gatewayLabel(gateway.gateway)}</span>
            <span className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className={`rounded-full px-2 py-0.5 font-medium ${gateway.configured ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                {gateway.configured ? t('payment_methods.configured', { defaultValue: 'Configured' }) : t('payment_methods.not_configured', { defaultValue: 'Not configured' })}
              </span>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700">{sourceLabel(gateway.source)}</span>
            </span>
          </button>
        ))}
      </div>

      {selectedMethods.length > 0 && (
        <section aria-label={t('payment_methods.checkout_methods.title', { defaultValue: 'Checkout payment methods' })} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
            <div>
              <h2 className="font-semibold text-slate-900">{t('payment_methods.checkout_methods.title', { defaultValue: 'Checkout payment methods' })}</h2>
              <p className="mt-1 text-sm text-slate-500">{t('payment_methods.checkout_methods.description', { defaultValue: 'Disabled methods are hidden from checkout.' })}</p>
            </div>
            {providerSync && (
              <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                <Button type="button" variant="secondary" disabled={providerSync.mutation.isPending} onClick={() => providerSync.mutation.mutate()}>
                  {providerSync.mutation.isPending
                    ? t('payment_methods.stripe_sync.refreshing', { defaultValue: 'Refreshing…' })
                    : t(`payment_methods.${providerSync.prefix}_sync.refresh`, { defaultValue: 'Refresh' })}
                </Button>
                <p role="status" className="text-xs text-slate-500">
                  {providerSync.sync?.ok && providerSync.sync.checked_at
                    ? t('payment_methods.stripe_sync.checked', { defaultValue: 'Checked {{time}}', time: new Date(providerSync.sync.checked_at).toLocaleTimeString() })
                    : providerSync.sync && !providerSync.sync.ok
                      ? t(`payment_methods.${providerSync.prefix}_sync.failed`, { defaultValue: 'Could not read the provider.' })
                      : null}
                </p>
              </div>
            )}
          </div>
          <ul className="divide-y divide-slate-100">
            {selectedMethods.map((method) => {
              const unsupported = method.supported === false;
              const hiddenAtCheckout = !unsupported && method.admin_enabled && !method.enabled;
              const stripeBlocked = method.stripe_status === 'off' || method.stripe_status === 'unavailable';
              return (
                <li key={method.method} className="px-5 py-4 sm:px-6">
                  <div className="flex items-center gap-4">
                    <MethodLogo method={method.method} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">{method.label}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {unsupported && <Badge color="slate">{t('payment_methods.checkout_methods.unsupported', { defaultValue: 'Not supported yet.' })}</Badge>}
                        {method.stripe_status && <Badge color={STRIPE_STATUS_COLORS[method.stripe_status]}>{providerStatusLabel('stripe', method.stripe_status)}</Badge>}
                        {method.airwallex_status && <Badge color={method.airwallex_status === 'unavailable' ? 'slate' : STRIPE_STATUS_COLORS[method.airwallex_status]}>{providerStatusLabel('airwallex', method.airwallex_status)}</Badge>}
                        {hiddenAtCheckout && <Badge color="amber">{t('payment_methods.hidden_at_checkout', { defaultValue: 'Hidden at checkout' })}</Badge>}
                      </div>
                      {!unsupported && !method.available && !stripeBlocked && (
                        <p className="mt-1 text-xs text-amber-700">{t('payment_methods.checkout_methods.unavailable', { defaultValue: 'Unavailable with current gateway settings.' })}</p>
                      )}
                    </div>
                    <span className="hidden w-16 text-right text-xs font-medium text-slate-500 sm:block">{method.admin_enabled ? enabledLabel : disabledLabel}</span>
                    <Switch
                      checked={method.admin_enabled}
                      label={`${method.label} ${method.admin_enabled ? enabledLabel : disabledLabel}`}
                      disabled={methodMutation.isPending || unsupported}
                      onChange={(enabled) => methodMutation.mutate({ method: method.method, enabled })}
                    />
                  </div>
                  {(() => {
                    // The Stripe card and the Airwallex card each keep their own logo selection.
                    const isAirwallexCard = method.method === 'airwallex';
                    const brandsState = method.method === 'card' ? cardBrands : isAirwallexCard ? airwallexCardBrands : undefined;
                    if (!brandsState) return null;

                    return (
                      <fieldset className="mt-3 rounded-lg bg-slate-50 px-4 py-3 sm:ml-[4.5rem]">
                        <legend className="px-1 text-xs font-medium text-slate-700">{t('payment_methods.checkout_methods.brands_title', { defaultValue: 'Card logos shown at checkout' })}</legend>
                        <p className="mb-2 text-xs text-slate-500">
                          {isAirwallexCard
                            ? t('payment_methods.checkout_methods.brands_hint_airwallex', { defaultValue: 'Display only. Which cards are accepted is set in your Airwallex account.' })
                            : t('payment_methods.checkout_methods.brands_hint', { defaultValue: 'Display only. Which cards are accepted is set in your Stripe account.' })}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {brandsState.available.map((brand) => {
                            const on = brandsState.enabled.includes(brand);
                            return (
                              <label
                                key={brand}
                                className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${on ? 'border-secondary bg-secondary/10 text-slate-900' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100'}`}
                              >
                                <input
                                  type="checkbox"
                                  className="sr-only"
                                  checked={on}
                                  disabled={brandsMutation.isPending}
                                  onChange={(event) => brandsMutation.mutate({
                                    brands: event.target.checked ? [...brandsState.enabled, brand] : brandsState.enabled.filter((item) => item !== brand),
                                    gateway: isAirwallexCard ? 'airwallex' : undefined,
                                  })}
                                />
                                {t(`payment_methods.card_brands.${brand}`, { defaultValue: brand })}
                              </label>
                            );
                          })}
                        </div>
                      </fieldset>
                    );
                  })()}
                </li>
              );
            })}
          </ul>
          {providerSync && (
            <p className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs text-slate-500 sm:px-6">
              {t(`payment_methods.${providerSync.prefix}_sync.hint`, { defaultValue: 'Read-only: this page never changes your provider account.' })}
            </p>
          )}
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="mb-4 font-semibold text-slate-900">{t('payment_methods.credentials.title', { defaultValue: 'Connection & credentials' })}</h2>
        <GatewayForm
          key={selected.gateway}
          gateway={selected}
          webhookUrl={selected.webhook_url}
          copyStatus={copyStatus}
          onCopyWebhookUrl={() => void copyWebhookUrl()}
          onSaved={(next) => queryClient.setQueryData<PaymentMethodsResponse>(QUERY_KEY, (current) => replaceGateway(current, next))}
        />
      </section>

      <section className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div>
          <h2 className="font-semibold text-slate-900">{t('payment_methods.cod.title', { defaultValue: 'Cash on delivery' })}</h2>
          <p className="mt-1 text-sm text-slate-500">{t('payment_methods.cod.description', { defaultValue: 'Let customers pay when their order is delivered.' })}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-slate-500">
            {codEnabled ? t('payment_methods.cod.enabled', { defaultValue: 'Enabled' }) : t('payment_methods.cod.disabled', { defaultValue: 'Disabled' })}
          </span>
          <Switch
            checked={codEnabled}
            label={`${t('payment_methods.cod.title', { defaultValue: 'Cash on delivery' })} ${codEnabled ? enabledLabel : disabledLabel}`}
            disabled={codMutation.isPending}
            onChange={(enabled) => codMutation.mutate(enabled)}
          />
        </div>
      </section>
    </div>
  );
}
