import { describe, expect, it } from 'vitest';
import { CustomField, normalizeCustomFieldResponse, normalizeCustomFieldsResponse } from './api';

const field: CustomField = {
  id: 4,
  name: { en: 'Care Instructions', vi: 'Hướng dẫn chăm sóc' },
  display_name: 'Care Instructions',
  handle: 'care_instructions',
  target: 'product',
  field_type: 'text',
  required: false,
  product_type_ids: [1],
  product_types: [{ id: 1, name: 'Beds' }],
  position: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('custom field API normalization', () => {
  it('normalizes wrapped and unwrapped list responses', () => {
    expect(normalizeCustomFieldsResponse({ data: [field] })).toEqual([field]);
    expect(normalizeCustomFieldsResponse([field])).toEqual([field]);
  });

  it('normalizes wrapped and unwrapped item responses', () => {
    expect(normalizeCustomFieldResponse({ data: field })).toEqual(field);
    expect(normalizeCustomFieldResponse(field)).toEqual(field);
  });
});
