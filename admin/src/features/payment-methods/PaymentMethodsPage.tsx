import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { fetchPaymentMethods, type PaymentGateway, type PaymentMethodState } from './api';
import { GatewayForm } from './GatewayForm';

const QUERY_KEY = ['admin', 'payment-methods'] as const;
const APPROVED_GATEWAYS: PaymentGateway[] = ['stripe', 'paypal', 'airwallex', 'payoneer'];

function replaceGateway(current: PaymentMethodState[] | undefined, next: PaymentMethodState): PaymentMethodState[] {
  return (current ?? []).map((gateway) => gateway.gateway === next.gateway ? next : gateway);
}

export function PaymentMethodsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const paymentMethodsQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => (await fetchPaymentMethods()).data,
  });
  const gateways = useMemo(
    () => (paymentMethodsQuery.data ?? []).filter((gateway) => APPROVED_GATEWAYS.includes(gateway.gateway)),
    [paymentMethodsQuery.data],
  );
  const [selectedGateway, setSelectedGateway] = useState<PaymentGateway>('stripe');

  useEffect(() => {
    if (gateways.length > 0 && !gateways.some((gateway) => gateway.gateway === selectedGateway)) {
      setSelectedGateway(gateways[0].gateway);
    }
  }, [gateways, selectedGateway]);

  if (paymentMethodsQuery.isLoading) {
    return <p role="status" className="p-8 text-sm text-slate-500">{t('payment_methods.loading', { defaultValue: 'Loading payment methods…' })}</p>;
  }

  if (paymentMethodsQuery.isError) {
    return (
      <p role="alert" className="p-8 text-sm text-red-600">
        {paymentMethodsQuery.error instanceof Error
          ? paymentMethodsQuery.error.message
          : t('payment_methods.error', { defaultValue: 'Payment methods could not be loaded.' })}
      </p>
    );
  }

  if (gateways.length === 0) {
    return <p role="status" className="p-8 text-sm text-slate-500">{t('payment_methods.empty', { defaultValue: 'No payment methods are available.' })}</p>;
  }

  const selected = gateways.find((gateway) => gateway.gateway === selectedGateway) ?? gateways[0];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
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
          {gateways.map((gateway) => <option key={gateway.gateway} value={gateway.gateway}>{gateway.label}</option>)}
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
            <span className="block font-semibold text-slate-900">{gateway.label}</span>
            <span className="mt-1 block text-xs text-slate-500">{gateway.configured ? t('payment_methods.configured', { defaultValue: 'Configured' }) : t('payment_methods.not_configured', { defaultValue: 'Not configured' })}</span>
          </button>
        ))}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <GatewayForm
          key={selected.gateway}
          gateway={selected}
          onSaved={(next) => queryClient.setQueryData<PaymentMethodState[]>(QUERY_KEY, (current) => replaceGateway(current, next))}
        />
      </section>
    </div>
  );
}
