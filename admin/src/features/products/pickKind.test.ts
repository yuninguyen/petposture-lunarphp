import { describe, expect, it } from 'vitest';
import { createProductPayload, isWebUrl, productFieldsFor, retailerLinkError, variantFieldsFor } from './pickKind';
import type { AttributeDefinition } from './api';

const field = (handle: string, required = false): AttributeDefinition => ({ handle, label: handle, type: 'text', section: null, system: false, required, value: '' });
const handles = (definitions: AttributeDefinition[]) => definitions.map((definition) => definition.handle);

describe('isWebUrl', () => {
  it('accepts http and https addresses only', () => {
    expect(isWebUrl('https://www.chewy.com/a/dp/1')).toBe(true);
    expect(isWebUrl('  http://www.chewy.com/a  ')).toBe(true);
    expect(isWebUrl('ftp://files.example.com/x')).toBe(false);
    expect(isWebUrl('javascript:alert(1)')).toBe(false);
    expect(isWebUrl('chewy.com/a')).toBe(false);
    expect(isWebUrl('')).toBe(false);
  });
});

describe('retailerLinkError', () => {
  it('asks for a link when it is empty and says when it is not a web address', () => {
    expect(retailerLinkError('')).toBe('products.validation.pick_link_required');
    expect(retailerLinkError('   ')).toBe('products.validation.pick_link_required');
    expect(retailerLinkError('chewy.com/a')).toBe('products.validation.pick_link_invalid');
    expect(retailerLinkError('https://www.chewy.com/a/dp/1')).toBeNull();
  });
});

describe('createProductPayload', () => {
  it('drops a link typed before switching to Shop, and trims the link of a Pick', () => {
    expect(createProductPayload({ name: 'A', kind: 'shop', external_url: 'https://www.chewy.com/a' })).toEqual({ name: 'A', kind: 'shop', external_url: '' });
    expect(createProductPayload({ name: 'A', kind: 'pick', external_url: '  https://www.chewy.com/a  ' })).toEqual({ name: 'A', kind: 'pick', external_url: 'https://www.chewy.com/a' });
  });
});

describe('productFieldsFor', () => {
  const all = [field('name', true), field('description'), field('external_url'), field('reference_price'), field('pros'), field('quick_specs'), field('second_retailer_slug'), field('second_retailer_url'), field('second_retailer_price'), field('second_retailer_price_checked_date'), field('breed_tags')];

  it('hides every Pick field on a Shop product, the second retailer included, and keeps the others', () => {
    expect(handles(productFieldsFor(all, false))).toEqual(['name', 'description', 'breed_tags']);
  });

  it('shows every field on a Pick and makes the retailer link required', () => {
    const shown = productFieldsFor(all, true);

    expect(handles(shown)).toEqual(handles(all));
    expect(shown.find((definition) => definition.handle === 'external_url')?.required).toBe(true);
    expect(shown.find((definition) => definition.handle === 'reference_price')?.required).toBe(false);
  });

  it('does not change the definitions it was given', () => {
    productFieldsFor(all, true);

    expect(all.find((definition) => definition.handle === 'external_url')?.required).toBe(false);
  });
});

describe('variantFieldsFor', () => {
  const all = [field('variant_note'), field('external_url'), field('reference_price')];

  it('hides the retailer link and price of a variant on a Shop product', () => {
    expect(handles(variantFieldsFor(all, false))).toEqual(['variant_note']);
  });

  it('keeps them on a Pick', () => {
    expect(handles(variantFieldsFor(all, true))).toEqual(['variant_note', 'external_url', 'reference_price']);
  });
});
