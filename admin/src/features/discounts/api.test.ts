import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ fetchJson: vi.fn() }));

vi.mock('@/lib/api', () => ({ fetchJson: mocks.fetchJson }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn((options) => options),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
  useMutation: vi.fn((options) => options),
}));

import {
  AMOUNT_OFF_TYPE,
  buildDiscountPayload,
  buildDiscountUpdatePayload,
  toIsoUtc,
  type DiscountFormValues,
} from './api';

const values = {
  name: 'Summer sale',
  handle: 'summer-sale',
  starts_at: '2026-08-31T19:00',
  ends_at: '',
  coupon: ' SAVE10 ',
  priority: '5',
  stop: false,
  max_uses: '100',
  max_uses_per_user: '1',
  min_price_usd: '25',
  fixed_value: false,
  percentage: '10',
  fixed_value_usd: '4.50',
} as DiscountFormValues;

describe('discounts api', () => {
  it('builds the AmountOff-only payload while preserving decimal money values', () => {
    const payload = buildDiscountPayload(values);

    expect(payload).toMatchObject({
      type: AMOUNT_OFF_TYPE,
      coupon: 'SAVE10',
      starts_at: new Date('2026-08-31T19:00').toISOString(),
      ends_at: null,
      data: { min_prices: { USD: 25 }, fixed_value: false, percentage: 10 },
    });
    expect(payload?.data).not.toHaveProperty('min_qty');
    expect(payload?.data).not.toHaveProperty('fixed_values');
  });

  it('builds fixed-cart AmountOff payloads without changing decimal values', () => {
    expect(buildDiscountUpdatePayload({ ...values, fixed_value: true })?.data)
      .toEqual({ min_prices: { USD: 25 }, fixed_value: true, fixed_values: { USD: 4.5 } });
  });

  it('returns a safe invalid result rather than throwing for malformed datetimes', () => {
    expect(toIsoUtc('not-a-date')).toBeNull();
  });
});
