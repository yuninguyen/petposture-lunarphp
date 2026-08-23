import { describe, expect, it } from 'vitest';
import {
  buildCreatePayload,
  buildUpdatePayload,
  customFieldFormSchema,
  generateHandle,
} from './customFieldSchema';

const validValues = {
  name: 'Care Instructions',
  handle: 'care_instructions',
  target: 'product' as const,
  field_type: 'text' as const,
  required: true,
  product_type_ids: [1, 2],
};

describe('generateHandle', () => {
  it('generates a lowercase underscore handle and removes accents', () => {
    expect(generateHandle('  Hướng dẫn Chăm sóc!  ')).toBe('huong_dan_cham_soc');
  });
});

describe('customFieldFormSchema', () => {
  it('accepts a valid create form', () => {
    expect(customFieldFormSchema.safeParse(validValues).success).toBe(true);
  });

  it('requires an English name and at least one Product Type', () => {
    const result = customFieldFormSchema.safeParse({
      ...validValues,
      name: '',
      product_type_ids: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join('.'))).toEqual(
        expect.arrayContaining(['name', 'product_type_ids']),
      );
    }
  });
});

describe('custom field payload helpers', () => {
  it('builds the create contract and omits an empty optional handle', () => {
    expect(buildCreatePayload({ ...validValues, handle: '' })).toEqual({
      name: validValues.name,
      target: 'product',
      field_type: 'text',
      required: true,
      product_type_ids: [1, 2],
    });
  });

  it('excludes immutable fields from the update payload', () => {
    const payload = buildUpdatePayload(validValues);

    expect(payload).toEqual({
      name: validValues.name,
      required: true,
      product_type_ids: [1, 2],
    });
    expect(payload).not.toHaveProperty('handle');
    expect(payload).not.toHaveProperty('target');
    expect(payload).not.toHaveProperty('field_type');
  });
});
