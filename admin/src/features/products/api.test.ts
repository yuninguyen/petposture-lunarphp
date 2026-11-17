import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ fetchJson: vi.fn() }));
vi.mock('@/lib/api', () => ({ fetchJson: mocks.fetchJson }));

import { attributeValues, buildProductsQuery, fetchProductPreviewUrl, flattenCollectionTrees, importProducts, previewProductImport } from './api';

describe('product api helpers', () => {
  it('builds server filter query without empty values', () => {
    expect(buildProductsQuery({ search: ' harness ', status: 'published', brand_id: 2, product_type_id: '', page: 3 })).toBe('/admin/products?search=harness&status=published&brand_id=2&page=3');
  });
  it('flattens collection trees with breadcrumb labels', () => {
    expect(flattenCollectionTrees([{ id: 1, name: 'Catalog', handle: 'catalog', collections: [{ id: 2, collection_group_id: 1, parent_id: null, name: { en: 'Dogs', vi: 'Chó' }, slug: 'dogs', children_count: 1, children: [{ id: 3, collection_group_id: 1, parent_id: 2, name: { en: 'Harnesses', vi: '' }, slug: 'harnesses', children_count: 0, children: [] }] }] }])).toEqual([{ id: 2, label: 'Catalog / Dogs', slug: 'dogs' }, { id: 3, label: 'Catalog / Dogs / Harnesses', slug: 'harnesses' }]);
  });
  it('extracts attribute values by handle', () => {
    expect(attributeValues([{ handle: 'name', label: 'Name', type: 'translated_text', section: null, system: true, required: true, value: { en: 'A', vi: 'B' } }])).toEqual({ name: { en: 'A', vi: 'B' } });
  });
  it('requests a signed preview URL for the current product', async () => {
    mocks.fetchJson.mockResolvedValueOnce({ url: 'https://storefront.test/preview' });
    await expect(fetchProductPreviewUrl(42)).resolves.toEqual({ url: 'https://storefront.test/preview' });
    expect(mocks.fetchJson).toHaveBeenCalledWith('/admin/products/42/preview-url');
  });
  it('sends the import file as form data to the preview and the import endpoints and unwraps the answer', async () => {
    const file = new File(['x'], 'picks.xlsx');
    mocks.fetchJson.mockResolvedValueOnce({ data: { summary: { create: 1, skipped_duplicate: 0, error: 0 }, rows: [] } });
    await expect(previewProductImport(file)).resolves.toEqual({ summary: { create: 1, skipped_duplicate: 0, error: 0 }, rows: [] });
    const [previewUrl, previewOptions] = mocks.fetchJson.mock.calls[mocks.fetchJson.mock.calls.length - 1];
    expect(previewUrl).toBe('/admin/products/import/preview');
    expect(previewOptions.method).toBe('POST');
    expect((previewOptions.body as FormData).get('file')).toBe(file);

    mocks.fetchJson.mockResolvedValueOnce({ data: { created: [], skipped: [], failed: [], photo_warnings: [] } });
    await importProducts(file);
    expect(mocks.fetchJson.mock.calls[mocks.fetchJson.mock.calls.length - 1][0]).toBe('/admin/products/import');
  });
});
