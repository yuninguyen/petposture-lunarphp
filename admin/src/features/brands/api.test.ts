import { describe, expect, it } from 'vitest';
import { normalizeBrandResponse, normalizeBrandsResponse } from './api';

const brand = {
  id: 3,
  name: 'Acme',
  products_count: 5,
};

describe('brand API normalization', () => {
  it('normalizes wrapped and unwrapped list responses', () => {
    expect(normalizeBrandsResponse({ data: [brand] })).toEqual([brand]);
    expect(normalizeBrandsResponse([brand])).toEqual([brand]);
  });

  it('normalizes wrapped and unwrapped item responses', () => {
    expect(normalizeBrandResponse({ data: brand })).toEqual(brand);
    expect(normalizeBrandResponse(brand)).toEqual(brand);
  });
});
