import { describe, expect, it } from 'vitest';
import { createProductSchema, merchantsPayload, productDefaults, productPayload, validateRequiredAttributes, variantFormSchema } from './ProductSchema';

describe('Product schemas', () => {
  it('validates and coerces create values', () => {
    expect(createProductSchema.parse({ name: ' Harness ', product_type_id: '2', sku: 'SKU', base_price: '12.50', kind: 'shop', external_url: '' })).toEqual({ name: 'Harness', product_type_id: 2, sku: 'SKU', base_price: '12.50', kind: 'shop', external_url: '' });
  });
  it('needs a web retailer link for a Pick, and does not ask for one for a Shop product', () => {
    const base = { name: 'Bowl', product_type_id: '1', sku: 'SKU', base_price: '9.99' };
    const messages = (values: object) => { const result = createProductSchema.safeParse(values); return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`); };

    expect(messages({ ...base, kind: 'pick', external_url: '' })).toEqual(['external_url: products.validation.pick_link_required']);
    expect(messages({ ...base, kind: 'pick', external_url: 'chewy.com/a' })).toEqual(['external_url: products.validation.pick_link_invalid']);
    expect(messages({ ...base, kind: 'pick', external_url: ' https://www.chewy.com/a/dp/1 ' })).toEqual([]);
    expect(messages({ ...base, kind: 'shop', external_url: '' })).toEqual([]);
    expect(messages({ ...base, kind: 'gift', external_url: '' })).toHaveLength(1);
  });
  it('requires both locales for required translated attributes', () => {
    const definitions = [{ handle: 'name', label: 'Name', type: 'translated_text' as const, section: null, system: true, required: true, value: { en: '', vi: '' } }];
    expect(validateRequiredAttributes(definitions, { name: { en: 'English', vi: '' } })).toEqual({ 'name.vi': 'products.validation.required' });
  });
  it('serializes ordered media with numeric ids', () => {
    expect(productPayload({ slug: ' Harness-One ', status: 'draft', brand_id: null, attributes: { name: 'A' }, collections: [4, 2], media: [{ id: '9', url: '/a.jpg', source: 'curator', alt: 'A cat' }], merchants: [], seo: { title: 'Harness SEO', description: '', keyphrase: '', og_title: '', og_description: '', og_image: null, canonical_url: '', is_indexable: true, is_followable: true } })).toMatchObject({ slug: 'harness-one', media: [{ id: 9, source: 'curator', alt: 'A cat' }], seo: { title: 'Harness SEO', is_indexable: true } });
  });
  it('sends the other stores as typed, keeps a row id, and leaves out a blank row', () => {
    const rows = [
      { id: 12, affiliate_network_id: 4, url: ' https://www.petsmart.com/x ', price: ' 40.99 ', price_checked_date: '2026-11-21' },
      { id: null, affiliate_network_id: 5, url: 'https://www.amazon.com/x', price: '', price_checked_date: '' },
      { id: null, affiliate_network_id: null, url: '   ', price: '', price_checked_date: '' },
    ];

    expect(merchantsPayload(rows)).toEqual([
      { id: 12, affiliate_network_id: 4, url: 'https://www.petsmart.com/x', price: '40.99', price_checked_date: '2026-11-21' },
      { id: null, affiliate_network_id: 5, url: 'https://www.amazon.com/x', price: '', price_checked_date: '' },
    ]);
    // a row that has a link but no merchant is still sent, so the server can say what is missing
    expect(merchantsPayload([{ id: null, affiliate_network_id: null, url: 'https://www.petsmart.com/x', price: '', price_checked_date: '' }])).toHaveLength(1);
  });
  it('hydrates the other stores of a Pick, and an empty list for a product without any', () => {
    const base = { slug: 'p', status: 'draft', brand_id: null, product_attributes: [], collection_ids: [], media: [], seo: {} } as any;

    expect(productDefaults(base).merchants).toEqual([]);
    expect(productDefaults({ ...base, merchants: [{ id: 3, affiliate_network_id: 4, url: 'https://www.petsmart.com/x', price: '40.99', price_checked_date: '2026-11-21' }] }).merchants).toEqual([
      { id: 3, affiliate_network_id: 4, url: 'https://www.petsmart.com/x', price: '40.99', price_checked_date: '2026-11-21' },
    ]);
  });
  it('hydrates the selected brand and newly mapped product fields', () => {
    const defaults = productDefaults({
      slug: 'harness', status: 'draft', brand_id: 7,
      product_attributes: [
        { handle: 'name', value: 'Harness' },
        { handle: 'description', value: '<p>Saved description</p>' },
        { handle: 'material', value: 'Polyester' },
      ],
      collection_ids: [], media: [],
      seo: { title: 'Harness SEO title', description: 'Saved meta description', keyphrase: 'dog harness', og_title: '', og_description: '', og_image: null, canonical_url: '', is_indexable: true, is_followable: true },
    } as any);

    expect(defaults.brand_id).toBe(7);
    expect(defaults.attributes).toMatchObject({ description: '<p>Saved description</p>', material: 'Polyester' });
    expect(defaults.seo).toMatchObject({ title: 'Harness SEO title', description: 'Saved meta description', keyphrase: 'dog harness' });
  });

  it('normalizes optional variant strings and numeric fields', () => {
    const parsed = variantFormSchema.parse({ sku: 'A', gtin: '', mpn: '', ean: '', stock: '0', cost: '', backorder: '0', purchasable: 'always', unit_quantity: '1', quantity_increment: '1', min_quantity: '1', tax_class_id: '2', tax_ref: '', shippable: true, length_value: '', length_unit: null, width_value: '', width_unit: null, height_value: '', height_unit: null, weight_value: '', weight_unit: null, base_price: '0', attributes: {} });
    expect(parsed).toMatchObject({ gtin: null, stock: 0, cost: null, tax_class_id: 2, base_price: '0' });
  });
});
