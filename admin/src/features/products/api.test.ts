import { describe, expect, it } from 'vitest';
import { attributeValues, buildProductsQuery, flattenCollectionTrees } from './api';

describe('product api helpers', () => {
  it('builds server filter query without empty values', () => {
    expect(buildProductsQuery({ search: ' harness ', status: 'published', brand_id: 2, product_type_id: '', page: 3 })).toBe('/admin/products?search=harness&status=published&brand_id=2&page=3');
  });
  it('flattens collection trees with breadcrumb labels', () => {
    expect(flattenCollectionTrees([{ id: 1, name: 'Catalog', handle: 'catalog', collections: [{ id: 2, collection_group_id: 1, parent_id: null, name: { en: 'Dogs', vi: 'Chó' }, children_count: 1, children: [{ id: 3, collection_group_id: 1, parent_id: 2, name: { en: 'Harnesses', vi: '' }, children_count: 0, children: [] }] }] }])).toEqual([{ id: 2, label: 'Catalog / Dogs' }, { id: 3, label: 'Catalog / Dogs / Harnesses' }]);
  });
  it('extracts attribute values by handle', () => {
    expect(attributeValues([{ handle: 'name', label: 'Name', type: 'translated_text', section: null, system: true, required: true, value: { en: 'A', vi: 'B' } }])).toEqual({ name: { en: 'A', vi: 'B' } });
  });
});
