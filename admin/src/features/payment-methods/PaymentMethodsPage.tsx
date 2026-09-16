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
  const gateways = useMemo(() => {
    const byGateway = new Map<PaymentGateway, PaymentMethodState>();
    for (const gateway of paymentMethodsQuery.data ?? []) {
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

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-6 space-y-2">
          <label htmlFor={`${selected.gateway}-webhook-url`} className="text-sm font-medium text-slate-700">
            {t('payment_methods.webhook_url', { defaultValue: 'Webhook URL' })}
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id={`${selected.gateway}-webhook-url`}
              type="text"
              readOnly
              value={selected.webhook_url}
              className="min-w-0 flex-1 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700"
            />
            <button
              type="button"
              onClick={() => void copyWebhookUrl()}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {t('payment_methods.copy_webhook_url', { defaultValue: 'Copy webhook URL' })}
            </button>
          </div>
          {copyStatus === 'copied' && <p role="status" className="text-sm text-green-700">{t('payment_methods.webhook_copied', { defaultValue: 'Webhook URL copied.' })}</p>}
          {copyStatus === 'error' && <p role="alert" className="text-sm text-red-600">{t('payment_methods.webhook_copy_error', { defaultValue: 'Webhook URL could not be copied.' })}</p>}
        </div>
        <GatewayForm
          key={selected.gateway}
          gateway={selected}
          onSaved={(next) => queryClient.setQueryData<PaymentMethodState[]>(QUERY_KEY, (current) => replaceGateway(current, next))}
        />
      </section>
    </div>
  );
}
