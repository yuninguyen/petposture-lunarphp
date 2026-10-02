import { fetchJson } from '@/lib/api';

export type PaymentGateway = 'stripe' | 'paypal' | 'airwallex' | 'payoneer';
export type PaymentSource = 'database' | 'environment' | 'mixed' | 'none';

export interface PaymentFieldState {
  value?: string;
  configured: boolean;
  source: Exclude<PaymentSource, 'mixed'>;
  hint?: string;
}

export interface PaymentMethodState {
  gateway: PaymentGateway;
  label: string;
  configured: boolean;
  source: PaymentSource;
  mode: string;
  webhook_url: string;
  fields: Record<string, PaymentFieldState>;
}

export interface CheckoutPaymentMethodState {
  method: string;
  label: string;
  gateway: string;
  enabled: boolean;
  available: boolean;
  admin_enabled: boolean;
  // false for listed-but-unbuilt methods (ACH Direct Debit, Venmo): shown, but locked.
  supported?: boolean;
}

export interface CardBrandsState {
  enabled: string[];
  available: string[];
}

export interface PaymentMethodUpdatePayload {
  mode?: string;
  fields?: Record<string, string>;
  clear_fields?: string[];
}

export interface PaymentMethodTestPayload {
  mode?: string;
  fields?: Record<string, string>;
}

export interface PaymentMethodTestResult {
  gateway: PaymentGateway;
  status: 'connected' | 'credentials_present';
  message: string;
  mode: string;
}

export interface PaymentMethodsResponse {
  data: PaymentMethodState[];
  cod: { enabled: boolean };
  methods?: CheckoutPaymentMethodState[];
  card_brands?: CardBrandsState;
}

export function fetchPaymentMethods(): Promise<PaymentMethodsResponse> {
  return fetchJson('/admin/finance/payment-methods');
}

export function updateCodPaymentMethod(enabled: boolean): Promise<{ data: { enabled: boolean } }> {
  return fetchJson('/admin/finance/payment-methods/cod', { method: 'PUT', body: { enabled } });
}

export function updateCheckoutPaymentMethod(method: string, enabled: boolean): Promise<{ data: CheckoutPaymentMethodState }> {
  return fetchJson(`/admin/finance/payment-methods/methods/${method}`, {
    method: 'PUT',
    body: { enabled },
  });
}

export function updateCardBrands(brands: string[]): Promise<{ data: CardBrandsState }> {
  return fetchJson('/admin/finance/payment-methods/card-brands', { method: 'PUT', body: { brands } });
}

export function updatePaymentMethod(
  gateway: PaymentGateway,
  payload: PaymentMethodUpdatePayload,
): Promise<{ data: PaymentMethodState }> {
  return fetchJson(`/admin/finance/payment-methods/${gateway}`, {
    method: 'PUT',
    body: { ...payload },
  });
}

export function testPaymentMethod(
  gateway: PaymentGateway,
  payload: PaymentMethodTestPayload,
): Promise<{ data: PaymentMethodTestResult }> {
  return fetchJson(`/admin/finance/payment-methods/${gateway}/test`, {
    method: 'POST',
    body: { ...payload },
  });
}
