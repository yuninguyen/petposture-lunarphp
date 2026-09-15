import React from 'react';
import { useTranslation } from 'react-i18next';

export type CardFunding = 'credit' | 'debit' | 'prepaid' | 'unknown';

export interface OrderCustomerAddressSource {
  first_name?: string | null;
  last_name?: string | null;
}

export interface OrderPresentationCustomerSource {
  shipping_address?: OrderCustomerAddressSource | null;
  billing_address?: OrderCustomerAddressSource | null;
  customer_name?: string | null;
}

export interface OrderPresentationLineSource {
  type?: string | null;
  quantity: number;
}

export interface OrderPresentationPaymentSource {
  payment_method?: string | null;
  payment_label?: string | null;
  payment_gateway?: string | null;
  card_funding?: CardFunding | string | null;
  card_brand?: string | null;
  card_last4?: string | null;
  paypal_payer_email?: string | null;
}

export interface PaymentPresentation {
  method: string;
  label: string;
  details: string | null;
  funding?: CardFunding | null;
  brand?: string | null;
  last4?: string | null;
  paypalPayerEmail?: string | null;
  gatewayLabel?: string | null;
}

/**
 * Extract customer name from shipping or billing address.
 * Returns null if no valid name is available.
 */
export function getOrderCustomerName(order?: OrderPresentationCustomerSource | null): string | null {
  if (!order) {
    return null;
  }

  const address = order.shipping_address ?? order.billing_address;
  if (address) {
    const first = (address.first_name ?? '').trim();
    const last = (address.last_name ?? '').trim();
    const full = [first, last].filter(Boolean).join(' ');
    if (full.length > 0) {
      return full;
    }
  }

  const explicitName = (order.customer_name ?? '').trim();
  return explicitName.length > 0 ? explicitName : null;
}

/**
 * Total item quantity strictly from product lines, excluding shipping lines.
 */
export function getOrderItemQuantity(lines?: OrderPresentationLineSource[] | null): number {
  if (!lines || !Array.isArray(lines)) {
    return 0;
  }

  return lines
    .filter((line) => line?.type !== 'shipping')
    .reduce((total, line) => {
      const qty = Number(line?.quantity);
      return total + (Number.isFinite(qty) && qty > 0 ? qty : 0);
    }, 0);
}

/**
 * Format money in standard format e.g. "USD $123.45" (currency code first).
 */
export function formatOrderAmount(value?: number | null, currency?: string | null, withCode = true): string {
  if (value == null || !Number.isFinite(value)) {
    return '—';
  }

  const currencyCode = (currency?.trim() || 'USD').toUpperCase();

  try {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

    if (!withCode) {
      return formatted.startsWith(currencyCode) ? formatted.slice(currencyCode.length).trim() : formatted;
    }

    // Some currencies format with the code directly (e.g. "USD 123.45")
    if (formatted.startsWith(currencyCode)) {
      return formatted;
    }

    return `${currencyCode} ${formatted}`;
  } catch {
    return withCode ? `${currencyCode} $${value.toFixed(2)}` : `$${value.toFixed(2)}`;
  }
}

const GATEWAY_NAMES: Record<string, string> = {
  stripe: 'Stripe',
  paypal: 'PayPal',
  airwallex: 'Airwallex',
  pingpong: 'PingPong',
  payoneer: 'Payoneer',
};

export function formatPaymentGatewayLabel(gateway?: string | null): string | null {
  if (!gateway) {
    return null;
  }
  const normalized = gateway.toLowerCase().trim();
  return GATEWAY_NAMES[normalized] ?? null;
}

/**
 * Resolve payment presentation metadata.
 * Generic fallback is "Card"; specific funding ("Credit Card", "Debit Card", "Prepaid Card")
 * is derived ONLY from explicit card_funding, never inferred from brand or last4.
 */
export function getOrderPaymentPresentation(order?: OrderPresentationPaymentSource | null): PaymentPresentation {
  if (!order) {
    return {
      method: 'unknown',
      label: '—',
      details: null,
      gatewayLabel: null,
    };
  }

  const rawMethod = (order.payment_method || '').toLowerCase().trim();
  const rawFunding = (order.card_funding || '').toLowerCase().trim();
  const brand = order.card_brand?.trim() || null;
  const last4 = order.card_last4?.trim() || null;
  const paypalEmail = order.paypal_payer_email?.trim() || null;
  const gatewayLabel = formatPaymentGatewayLabel(order.payment_gateway);

  // Determine if this is a card payment
  const isCard = rawMethod === 'card' || Boolean(rawFunding || brand || last4);

  if (isCard) {
    let funding: CardFunding = 'unknown';
    let label = 'Card';

    if (rawFunding === 'credit') {
      funding = 'credit';
      label = 'Credit Card';
    } else if (rawFunding === 'debit') {
      funding = 'debit';
      label = 'Debit Card';
    } else if (rawFunding === 'prepaid') {
      funding = 'prepaid';
      label = 'Prepaid Card';
    }

    const formattedBrand = brand
      ? brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase()
      : null;

    let details: string | null = null;
    if (formattedBrand && last4) {
      details = `${formattedBrand} •••• ${last4}`;
    } else if (formattedBrand) {
      details = formattedBrand;
    } else if (last4) {
      details = `•••• ${last4}`;
    }

    return {
      method: 'card',
      label,
      details,
      funding,
      brand: formattedBrand,
      last4,
      gatewayLabel,
    };
  }

  if (rawMethod === 'paypal') {
    return {
      method: 'paypal',
      label: 'PayPal',
      details: paypalEmail,
      paypalPayerEmail: paypalEmail,
      gatewayLabel,
    };
  }

  if (rawMethod === 'cod') {
    return {
      method: 'cod',
      label: 'Cash on Delivery',
      details: null,
      gatewayLabel,
    };
  }

  return {
    method: rawMethod || 'unknown',
    label: order.payment_label || (rawMethod ? rawMethod.toUpperCase() : '—'),
    details: null,
    gatewayLabel,
  };
}

export interface OrderPaymentDisplayProps {
  order?: OrderPresentationPaymentSource | null;
  showPayerEmail?: boolean;
  className?: string;
}

function localizedPaymentLabel(t: (key: string) => string, presentation: PaymentPresentation): string {
  if (presentation.method === 'card') {
    switch (presentation.funding) {
      case 'credit':
        return t('orders.payment_credit_card');
      case 'debit':
        return t('orders.payment_debit_card');
      case 'prepaid':
        return t('orders.payment_prepaid_card');
      default:
        return t('orders.payment_card');
    }
  }

  if (presentation.method === 'paypal') {
    return t('orders.payment_paypal');
  }

  if (presentation.method === 'cod') {
    return t('orders.payment_cod');
  }

  return presentation.label;
}

export function OrderPaymentDisplay({
  order,
  showPayerEmail = false,
  className = '',
}: OrderPaymentDisplayProps): React.ReactElement {
  const { t } = useTranslation();
  const presentation = getOrderPaymentPresentation(order);

  if (presentation.label === '—' && !presentation.details) {
    return <span className={className}>—</span>;
  }

  const label = localizedPaymentLabel(t, presentation);
  const showGateway =
    presentation.method === 'card' &&
    Boolean(presentation.gatewayLabel) &&
    presentation.gatewayLabel?.toLowerCase() !== label.toLowerCase();

  return (
    <div className={`inline-flex flex-col gap-0.5 ${className}`}>
      <span className="font-medium text-slate-900">{label}</span>
      {presentation.method === 'card' && presentation.details && (
        <span className="text-xs text-slate-500">{presentation.details}</span>
      )}
      {showGateway && (
        <span className="text-xs text-slate-500">{presentation.gatewayLabel}</span>
      )}
      {presentation.method === 'paypal' && showPayerEmail && presentation.paypalPayerEmail && (
        <span className="text-xs text-slate-500">{presentation.paypalPayerEmail}</span>
      )}
    </div>
  );
}
