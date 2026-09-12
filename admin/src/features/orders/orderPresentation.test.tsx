import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';

const paymentLabels: Record<string, string> = {
  'orders.payment_card': 'Card',
  'orders.payment_credit_card': 'Credit Card',
  'orders.payment_debit_card': 'Debit Card',
  'orders.payment_prepaid_card': 'Prepaid Card',
  'orders.payment_paypal': 'PayPal',
  'orders.payment_cod': 'Cash on delivery',
};
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => paymentLabels[key] ?? key }) }));

import {
  getOrderCustomerName,
  getOrderItemQuantity,
  formatOrderAmount,
  getOrderPaymentPresentation,
  OrderPaymentDisplay,
} from './orderPresentation';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('orderPresentation helpers', () => {
  describe('getOrderCustomerName', () => {
    it('returns full customer name from first and last name', () => {
      expect(
        getOrderCustomerName({
          shipping_address: { first_name: 'Jane', last_name: 'Doe' },
        })
      ).toBe('Jane Doe');
    });

    it('returns single name when only first or last name is present', () => {
      expect(
        getOrderCustomerName({
          shipping_address: { first_name: 'Jane', last_name: '' },
        })
      ).toBe('Jane');

      expect(
        getOrderCustomerName({
          shipping_address: { first_name: null, last_name: 'Doe' },
        })
      ).toBe('Doe');
    });

    it('falls back to billing address if shipping address is missing', () => {
      expect(
        getOrderCustomerName({
          shipping_address: null,
          billing_address: { first_name: 'Bill', last_name: 'Smith' },
        })
      ).toBe('Bill Smith');
    });

    it('returns null when names are whitespace or empty', () => {
      expect(
        getOrderCustomerName({
          shipping_address: { first_name: '   ', last_name: '' },
        })
      ).toBeNull();

      expect(getOrderCustomerName(null)).toBeNull();
    });
  });

  describe('getOrderItemQuantity', () => {
    it('sums product line quantities and strictly excludes shipping lines', () => {
      const lines = [
        { type: 'product', quantity: 2 },
        { type: 'product', quantity: 3 },
        { type: 'shipping', quantity: 1 },
      ];
      expect(getOrderItemQuantity(lines)).toBe(5);
    });

    it('handles empty or missing lines safely', () => {
      expect(getOrderItemQuantity([])).toBe(0);
      expect(getOrderItemQuantity(null)).toBe(0);
      expect(getOrderItemQuantity(undefined)).toBe(0);
    });
  });

  describe('formatOrderAmount', () => {
    it('formats USD with currency code first e.g. USD $123.45', () => {
      expect(formatOrderAmount(123.45, 'USD')).toBe('USD $123.45');
    });

    it('formats zero correctly', () => {
      expect(formatOrderAmount(0, 'USD')).toBe('USD $0.00');
    });

    it('returns dash for null or undefined value', () => {
      expect(formatOrderAmount(null, 'USD')).toBe('—');
      expect(formatOrderAmount(undefined, 'USD')).toBe('—');
    });

    it('formats non-USD currency codes with symbol', () => {
      const formattedEur = formatOrderAmount(12.99, 'EUR');
      expect(formattedEur).toContain('EUR');
      expect(formattedEur).toContain('12.99');
    });
  });

  describe('getOrderPaymentPresentation', () => {
    it('resolves explicit credit funding to Credit Card', () => {
      const presentation = getOrderPaymentPresentation({
        payment_method: 'card',
        card_funding: 'credit',
        card_brand: 'visa',
        card_last4: '4242',
      });
      expect(presentation.label).toBe('Credit Card');
      expect(presentation.funding).toBe('credit');
      expect(presentation.details).toBe('Visa •••• 4242');
    });

    it('resolves explicit debit funding to Debit Card', () => {
      const presentation = getOrderPaymentPresentation({
        payment_method: 'card',
        card_funding: 'debit',
        card_brand: 'mastercard',
        card_last4: '4444',
      });
      expect(presentation.label).toBe('Debit Card');
      expect(presentation.funding).toBe('debit');
      expect(presentation.details).toBe('Mastercard •••• 4444');
    });

    it('resolves explicit prepaid funding to Prepaid Card', () => {
      const presentation = getOrderPaymentPresentation({
        payment_method: 'card',
        card_funding: 'prepaid',
        card_brand: 'amex',
        card_last4: '0005',
      });
      expect(presentation.label).toBe('Prepaid Card');
      expect(presentation.funding).toBe('prepaid');
      expect(presentation.details).toBe('Amex •••• 0005');
    });

    it('defaults to Card when funding is unknown, null, or missing — never infers from brand/last4', () => {
      const presentation = getOrderPaymentPresentation({
        payment_method: 'card',
        card_funding: null,
        card_brand: 'visa',
        card_last4: '4242',
      });
      expect(presentation.label).toBe('Card');
      expect(presentation.funding).toBe('unknown');
      expect(presentation.details).toBe('Visa •••• 4242');
    });

    it('handles brand-only and last4-only card metadata', () => {
      const brandOnly = getOrderPaymentPresentation({
        payment_method: 'card',
        card_funding: 'credit',
        card_brand: 'visa',
      });
      expect(brandOnly.label).toBe('Credit Card');
      expect(brandOnly.details).toBe('Visa');

      const last4Only = getOrderPaymentPresentation({
        payment_method: 'card',
        card_last4: '1234',
      });
      expect(last4Only.label).toBe('Card');
      expect(last4Only.details).toBe('•••• 1234');
    });

    it('resolves PayPal with and without payer email', () => {
      const withEmail = getOrderPaymentPresentation({
        payment_method: 'paypal',
        paypal_payer_email: 'buyer@example.com',
      });
      expect(withEmail.label).toBe('PayPal');
      expect(withEmail.paypalPayerEmail).toBe('buyer@example.com');
      expect(withEmail.details).toBe('buyer@example.com');

      const withoutEmail = getOrderPaymentPresentation({
        payment_method: 'paypal',
        paypal_payer_email: null,
      });
      expect(withoutEmail.label).toBe('PayPal');
      expect(withoutEmail.paypalPayerEmail).toBeNull();
      expect(withoutEmail.details).toBeNull();
    });

    it('resolves Cash on Delivery', () => {
      const cod = getOrderPaymentPresentation({
        payment_method: 'cod',
      });
      expect(cod.label).toBe('Cash on Delivery');
      expect(cod.details).toBeNull();
    });
  });

  describe('OrderPaymentDisplay component', () => {
    it('renders debit card presentation with icon and details', () => {
      const host = document.createElement('div');
      document.body.appendChild(host);
      const root = createRoot(host);

      act(() => {
        root.render(
          createElement(OrderPaymentDisplay, {
            order: {
              payment_method: 'card',
              card_funding: 'debit',
              card_brand: 'mastercard',
              card_last4: '4444',
            },
          })
        );
      });

      expect(host.textContent).toContain('Debit Card');
      expect(host.textContent).toContain('Mastercard •••• 4444');
      const svg = host.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg?.getAttribute('aria-hidden')).toBe('true');

      act(() => root.unmount());
      host.remove();
    });

    it('renders PayPal and displays payer email only when showPayerEmail is true', () => {
      const host = document.createElement('div');
      document.body.appendChild(host);
      const root = createRoot(host);

      // Without showPayerEmail
      act(() => {
        root.render(
          createElement(OrderPaymentDisplay, {
            order: {
              payment_method: 'paypal',
              paypal_payer_email: 'payer@example.com',
            },
            showPayerEmail: false,
          })
        );
      });
      expect(host.textContent).toContain('PayPal');
      expect(host.textContent).not.toContain('payer@example.com');

      // With showPayerEmail
      act(() => {
        root.render(
          createElement(OrderPaymentDisplay, {
            order: {
              payment_method: 'paypal',
              paypal_payer_email: 'payer@example.com',
            },
            showPayerEmail: true,
          })
        );
      });
      expect(host.textContent).toContain('PayPal');
      expect(host.textContent).toContain('payer@example.com');

      act(() => root.unmount());
      host.remove();
    });
  });
});
