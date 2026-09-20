import { describe, expect, it } from 'vitest';
import { can } from './permissions';

describe('can', () => {
  it('returns true when the ability is present', () => {
    expect(can(['view_any_brand', 'update_brand'], 'view_any_brand')).toBe(true);
  });

  it('returns false when the ability is absent', () => {
    expect(can(['view_any_brand'], 'delete_brand')).toBe(false);
  });

  it('returns false when abilities is undefined', () => {
    expect(can(undefined, 'view_any_brand')).toBe(false);
  });
});
