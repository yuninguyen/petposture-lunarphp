import { describe, expect, it } from 'vitest';
import { createProductSchema, productPayload, validateRequiredAttributes, variantFormSchema } from './ProductSchema';

describe('Product schemas', () => {
  it('validates and coerces create values', () => {
    expect(createProductSchema.parse({ name: ' Harness ', product_type_id: '2', sku: 'SKU', base_price: '12.50' })).toEqual({ name: 'Harness', product_type_id: 2, sku: 'SKU', base_price: '12.50' });
  });
  it('requires both locales for required translated attributes', () => {
    const definitions = [{ handle: 'name', label: 'Name', type: 'translated_text' as const, section: null, system: true, required: true, value: { en: '', vi: '' } }];
    expect(validateRequiredAttributes(definitions, { name: { en: 'English', vi: '' } })).toEqual({ 'name.vi': 'products.validation.required' });
  });
  it('serializes ordered media with numeric ids', () => {
    expect(productPayload({ slug: ' Harness-One ', status: 'draft', brand_id: null, attributes: { name: 'A' }, collections: [4, 2], media: [{ id: '9', url: '/a.jpg', source: 'curator', alt: 'A cat' }], seo: { title: 'Harness SEO', description: '', keyphrase: '', og_title: '', og_description: '', og_image: null, canonical_url: '', is_indexable: true, is_followable: true } })).toMatchObject({ slug: 'harness-one', media: [{ id: 9, source: 'curator', alt: 'A cat' }], seo: { title: 'Harness SEO', is_indexable: true } });
  });
  it('normalizes optional variant strings and numeric fields', () => {
    const parsed = variantFormSchema.parse({ sku: 'A', gtin: '', mpn: '', ean: '', stock: '0', backorder: '0', purchasable: 'always', unit_quantity: '1', quantity_increment: '1', min_quantity: '1', tax_class_id: '2', tax_ref: '', shippable: true, length_value: '', length_unit: null, width_value: '', width_unit: null, height_value: '', height_unit: null, weight_value: '', weight_unit: null, base_price: '0', attributes: {} });
    expect(parsed).toMatchObject({ gtin: null, stock: 0, tax_class_id: 2, base_price: '0' });
  });
});
