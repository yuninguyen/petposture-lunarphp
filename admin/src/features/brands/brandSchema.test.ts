import { describe, expect, it } from 'vitest';
import { brandFormSchema, buildBrandPayload } from './brandSchema';

describe('brand form schema and payload', () => {
  it('requires a non-empty English business name', () => {
    expect(brandFormSchema.safeParse({ name: '   ' }).success).toBe(false);
    expect(brandFormSchema.parse({ name: ' Acme ' }).name).toBe('Acme');
  });

  it('builds a trimmed name-only payload', () => {
    expect(buildBrandPayload({ name: ' Acme ' })).toEqual({ name: 'Acme' });
  });
});
