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

export interface PaymentMethodUpdatePayload extends Record<string, unknown> {
  mode?: string;
  fields?: Record<string, string>;
  clear_fields?: string[];
}

export interface PaymentMethodTestPayload extends Record<string, unknown> {
  mode?: string;
  fields?: Record<string, string>;
}

export interface PaymentMethodTestResult {
  gateway: PaymentGateway;
  status: 'connected' | 'credentials_present';
  message: string;
  mode: string;
}

export function fetchPaymentMethods(): Promise<{ data: PaymentMethodState[] }> {
  return fetchJson('/admin/finance/payment-methods');
}

export function updatePaymentMethod(
  gateway: PaymentGateway,
  payload: PaymentMethodUpdatePayload,
): Promise<{ data: PaymentMethodState }> {
  return fetchJson(`/admin/finance/payment-methods/${gateway}`, { method: 'PUT', body: payload });
}

export function testPaymentMethod(
  gateway: PaymentGateway,
  payload: PaymentMethodTestPayload,
): Promise<{ data: PaymentMethodTestResult }> {
  return fetchJson(`/admin/finance/payment-methods/${gateway}/test`, { method: 'POST', body: payload });
}
