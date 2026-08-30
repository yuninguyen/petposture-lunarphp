import { describe, expect, it } from 'vitest';
import { canManageCommerce, canRefundOrders, getAdminHomeRoute } from './App';

describe('commerce admin role handling', () => {
  it('grants sales visibility to core admin, Order Manager, and Support only', () => {
    expect(canManageCommerce(['admin'])).toBe(true);
    expect(canManageCommerce(['Order Manager'])).toBe(true);
    expect(canManageCommerce(['Support'])).toBe(true);
    expect(canManageCommerce(['Product Manager'])).toBe(false);
  });

  it('uses orders as the Commerce-only home and excludes Support from refunds', () => {
    expect(getAdminHomeRoute(['Support'])).toBe('/orders');
    expect(getAdminHomeRoute(['Order Manager'])).toBe('/orders');
    expect(canRefundOrders(['Support'])).toBe(false);
    expect(canRefundOrders(['Order Manager'])).toBe(true);
    expect(canRefundOrders(['staff'])).toBe(true);
  });
});
