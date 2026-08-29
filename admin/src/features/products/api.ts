import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '@/lib/api';
import { fetchBrands, type Brand } from '@/features/brands/api';
import { fetchProductTypes, type ProductType } from '@/features/product-types/api';
import { fetchCollectionTrees, type CollectionGroupTree, type CollectionNode } from '@/features/collections/api';

export type ProductStatus = 'draft' | 'published';
export type ProductAssociationType = 'cross-sell' | 'up-sell' | 'alternate';
export type AttributeType = 'text' | 'translated_text';
export type LocalizedText = { en: string; vi: string };
export type AttributeValue = string | LocalizedText;
export type AttributeValues = Record<string, AttributeValue>;

export interface AttributeDefinition {
  handle: string;
  label: string;
  type: AttributeType;
  section: string | null;
  system: boolean;
  required: boolean;
  value: AttributeValue;
}
export interface ProductMedia { id: string; url: string; source: 'spatie' | 'curator'; alt: string }
export interface ProductSeo { title: string; description: string; keyphrase: string; og_title: string; og_description: string; og_image: string | null; canonical_url: string; is_indexable: boolean; is_followable: boolean }
export interface Currency { id: number; code: string; decimal_places: number; factor: number }
export interface TaxClass { id: number; name: string }
export interface OptionValue { option_id: number; option_name: string; value_id: number; value_name: string }
export interface ProductOptionValue { id: number; name: string }
export interface ProductOption { id: number; name: string; shared: boolean; values: ProductOptionValue[] }
export interface ProductVariant {
  id: number; product_id: number; sku: string; gtin: string | null; mpn: string | null; ean: string | null;
  stock: number; backorder: number; purchasable: 'always' | 'in_stock' | 'in_stock_or_on_backorder';
  unit_quantity: number; quantity_increment: number; min_quantity: number; tax_class_id: number;
  tax_ref: string | null; shippable: boolean; length_value: string | number | null; length_unit: string | null;
  width_value: string | number | null; width_unit: string | null; height_value: string | number | null;
  height_unit: string | null; weight_value: string | number | null; weight_unit: string | null;
  base_price: string; formatted_price: string | null; has_order_history: boolean; option_values: OptionValue[]; attributes: AttributeDefinition[];
}
export interface ProductDetail {
  id: number; slug: string | null; status: ProductStatus; brand_id: number | null; product_type_id: number;
  product_type: { id: number; name: string }; brand: { id: number; name: string } | null;
  has_variants: boolean; product_attributes: AttributeDefinition[]; product_options: ProductOption[]; variants: ProductVariant[];
  collection_ids: number[]; media: ProductMedia[]; seo: ProductSeo; default_currency: Currency; tax_classes: TaxClass[]; updated_at: string | null;
}
export interface ProductAssociation { id: number; type: ProductAssociationType; target: { id: number; name: string; status: ProductStatus; slug: string | null; thumbnail: string | null } }
export interface ProductSummary {
  id: number; thumbnail: string | null; name: string; description: string; product_type: { id: number; name: string };
  brand: { id: number; name: string } | null; first_collection: { id: number; name: string } | null;
  total_stock: number; price: { amount: number; formatted: string; currency: string } | null;
  status: ProductStatus; created_at: string | null; updated_at: string | null;
}
export interface ProductsPage { data: ProductSummary[]; meta: { current_page: number; last_page: number; per_page: number; total: number } }
export interface ProductFilters { search?: string; status?: ProductStatus | ''; brand_id?: number | ''; product_type_id?: number | ''; page?: number; per_page?: number }
export interface CreateProductPayload { name: string; product_type_id: number; sku: string; base_price: string }
export interface UpdateProductPayload { slug: string; status: ProductStatus; brand_id: number | null; attributes: AttributeValues; collections: number[]; media: Array<{ id: number; source: ProductMedia['source']; alt: string }>; seo: ProductSeo }
export interface UpdateVariantPayload {
  sku: string; gtin: string | null; mpn: string | null; ean: string | null; stock: number; backorder: number;
  purchasable: ProductVariant['purchasable']; unit_quantity: number; quantity_increment: number; min_quantity: number;
  tax_class_id: number; tax_ref: string | null; shippable: boolean; length_value: string | null; length_unit: string | null;
  width_value: string | null; width_unit: string | null; height_value: string | null; height_unit: string | null;
  weight_value: string | null; weight_unit: string | null; base_price: string; attributes: AttributeValues;
}
export interface SaveProductOptionsPayload { options: Array<{ id?: number; name: string; values: Array<{ id?: number; name: string }> }> }
export interface CollectionOption { id: number; label: string; slug: string }

export function buildProductsQuery(filters: ProductFilters): string {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set('search', filters.search.trim());
  if (filters.status) params.set('status', filters.status);
  if (filters.brand_id !== '' && filters.brand_id != null) params.set('brand_id', String(filters.brand_id));
  if (filters.product_type_id !== '' && filters.product_type_id != null) params.set('product_type_id', String(filters.product_type_id));
  if (filters.page) params.set('page', String(filters.page));
  if (filters.per_page) params.set('per_page', String(filters.per_page));
  const query = params.toString();
  return `/admin/products${query ? `?${query}` : ''}`;
}
function unwrap<T>(response: T | { data: T }): T { return 'data' in (response as object) ? (response as { data: T }).data : response as T }
export async function fetchProducts(filters: ProductFilters): Promise<ProductsPage> { return fetchJson(buildProductsQuery(filters)); }
export async function fetchProduct(id: number): Promise<ProductDetail> { return unwrap(await fetchJson<ProductDetail | { data: ProductDetail }>(`/admin/products/${id}`)); }
export async function fetchProductPreviewUrl(id: number): Promise<{ url: string }> { return fetchJson(`/admin/products/${id}/preview-url`); }
export async function createProduct(payload: CreateProductPayload): Promise<ProductDetail> { return unwrap(await fetchJson<ProductDetail | { data: ProductDetail }>('/admin/products', { method: 'POST', body: { ...payload } })); }
export async function updateProduct(id: number, payload: UpdateProductPayload): Promise<ProductDetail> { return unwrap(await fetchJson<ProductDetail | { data: ProductDetail }>(`/admin/products/${id}`, { method: 'PUT', body: { ...payload } })); }
export async function updateProductVariant(productId: number, variantId: number, payload: UpdateVariantPayload): Promise<ProductVariant> { return unwrap(await fetchJson<ProductVariant | { data: ProductVariant }>(`/admin/products/${productId}/variants/${variantId}`, { method: 'PUT', body: { ...payload } })); }
export async function saveProductOptions(productId: number, payload: SaveProductOptionsPayload): Promise<ProductOption[]> { return unwrap(await fetchJson<ProductOption[] | { data: ProductOption[] }>(`/admin/products/${productId}/options`, { method: 'POST', body: { ...payload } })); }
export async function generateProductVariants(productId: number): Promise<ProductVariant[]> { return unwrap(await fetchJson<ProductVariant[] | { data: ProductVariant[] }>(`/admin/products/${productId}/variants/generate`, { method: 'POST' })); }
export async function deleteProductVariant(productId: number, variantId: number): Promise<void> { await fetchJson(`/admin/products/${productId}/variants/${variantId}`, { method: 'DELETE' }); }
export async function fetchProductAssociations(productId: number): Promise<ProductAssociation[]> { return unwrap(await fetchJson<ProductAssociation[] | { data: ProductAssociation[] }>(`/admin/products/${productId}/associations`)); }
export async function createProductAssociation(productId: number, targetProductId: number, type: ProductAssociationType): Promise<ProductAssociation> { return unwrap(await fetchJson<ProductAssociation | { data: ProductAssociation }>(`/admin/products/${productId}/associations`, { method: 'POST', body: { target_product_id: targetProductId, type } })); }
export async function deleteProductAssociation(productId: number, associationId: number): Promise<void> { await fetchJson(`/admin/products/${productId}/associations/${associationId}`, { method: 'DELETE' }); }
export async function bulkDeleteProducts(ids: number[]): Promise<void> { await fetchJson('/admin/products/bulk-delete', { method: 'POST', body: { ids } }); }
export async function bulkUpdateProductStatus(ids: number[], status: ProductStatus): Promise<{ updated: number }> { return fetchJson('/admin/products/bulk-status', { method: 'POST', body: { ids, status } }); }
export async function deleteProduct(id: number): Promise<void> { await fetchJson(`/admin/products/${id}`, { method: 'DELETE' }); }

function flattenNodes(nodes: CollectionNode[], parents: string[] = []): CollectionOption[] {
  return nodes.flatMap((node) => {
    const name = node.name.en || node.name.vi || `#${node.id}`;
    const path = [...parents, name];
    return [{ id: node.id, label: path.join(' / '), slug: node.slug }, ...flattenNodes(node.children ?? [], path)];
  });
}
export function flattenCollectionTrees(groups: CollectionGroupTree[]): CollectionOption[] {
  return groups.flatMap((group) => flattenNodes(group.collections, [group.name]));
}
export function attributeValues(definitions: AttributeDefinition[]): AttributeValues {
  return Object.fromEntries(definitions.map((definition) => [definition.handle, definition.value]));
}

export function useProducts(filters: ProductFilters) { return useQuery({ queryKey: ['products', filters], queryFn: () => fetchProducts(filters) }); }
export function useProduct(id?: number) { return useQuery({ queryKey: ['products', id], queryFn: () => fetchProduct(id!), enabled: Boolean(id) }); }
export function useProductPreviewUrl() { return useMutation({ mutationFn: fetchProductPreviewUrl }); }
export function useProductLookups() {
  const productTypes = useQuery({ queryKey: ['product-types'], queryFn: fetchProductTypes });
  const brands = useQuery({ queryKey: ['brands'], queryFn: fetchBrands });
  const collections = useQuery({ queryKey: ['collections', 'tree'], queryFn: fetchCollectionTrees });
  return { productTypes: (productTypes.data ?? []) as ProductType[], brands: (brands.data ?? []) as Brand[], collectionOptions: flattenCollectionTrees(collections.data ?? []), isLoading: productTypes.isLoading || brands.isLoading || collections.isLoading };
}
export function useCreateProduct() { const qc = useQueryClient(); return useMutation({ mutationFn: createProduct, onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }) }); }
export function useUpdateProduct() { const qc = useQueryClient(); return useMutation({ mutationFn: ({ id, payload }: { id: number; payload: UpdateProductPayload }) => updateProduct(id, payload), onSuccess: (data) => { qc.setQueryData(['products', data.id], data); qc.invalidateQueries({ queryKey: ['products'] }); } }); }
export function useUpdateProductVariant() { const qc = useQueryClient(); return useMutation({ mutationFn: ({ productId, variantId, payload }: { productId: number; variantId: number; payload: UpdateVariantPayload }) => updateProductVariant(productId, variantId, payload), onSuccess: (variant, variables) => { qc.setQueryData<ProductDetail>(['products', variables.productId], (current) => current ? { ...current, variants: current.variants.map((item) => item.id === variant.id ? variant : item) } : current); qc.invalidateQueries({ queryKey: ['products'], exact: true }); } }); }
export function useSaveProductOptions() { const qc = useQueryClient(); return useMutation({ mutationFn: ({ productId, payload }: { productId: number; payload: SaveProductOptionsPayload }) => saveProductOptions(productId, payload), onSuccess: (productOptions, variables) => { qc.setQueryData<ProductDetail>(['products', variables.productId], (current) => current ? { ...current, product_options: productOptions } : current); } }); }
export function useGenerateProductVariants() { const qc = useQueryClient(); return useMutation({ mutationFn: ({ productId }: { productId: number }) => generateProductVariants(productId), onSuccess: (variants, variables) => { qc.setQueryData<ProductDetail>(['products', variables.productId], (current) => current ? { ...current, variants, has_variants: variants.length > 1 } : current); qc.invalidateQueries({ queryKey: ['products'], exact: true }); } }); }
export function useDeleteProductVariant() { const qc = useQueryClient(); return useMutation({ mutationFn: ({ productId, variantId }: { productId: number; variantId: number }) => deleteProductVariant(productId, variantId), onSuccess: (_data, variables) => { qc.setQueryData<ProductDetail>(['products', variables.productId], (current) => current ? { ...current, variants: current.variants.filter((variant) => variant.id !== variables.variantId), has_variants: current.variants.length - 1 > 1 } : current); qc.invalidateQueries({ queryKey: ['products'], exact: true }); } }); }
export function useProductAssociations(productId: number) { return useQuery({ queryKey: ['products', productId, 'associations'], queryFn: () => fetchProductAssociations(productId) }); }
export function useCreateProductAssociation() { const qc = useQueryClient(); return useMutation({ mutationFn: ({ productId, targetProductId, type }: { productId: number; targetProductId: number; type: ProductAssociationType }) => createProductAssociation(productId, targetProductId, type), onSuccess: (_data, variables) => qc.invalidateQueries({ queryKey: ['products', variables.productId, 'associations'] }) }); }
export function useDeleteProductAssociation() { const qc = useQueryClient(); return useMutation({ mutationFn: ({ productId, associationId }: { productId: number; associationId: number }) => deleteProductAssociation(productId, associationId), onSuccess: (_data, variables) => qc.invalidateQueries({ queryKey: ['products', variables.productId, 'associations'] }) }); }
export function useBulkDeleteProducts() { const qc = useQueryClient(); return useMutation({ mutationFn: bulkDeleteProducts, onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }) }); }
export function useBulkUpdateProductStatus() { const qc = useQueryClient(); return useMutation({ mutationFn: ({ ids, status }: { ids: number[]; status: ProductStatus }) => bulkUpdateProductStatus(ids, status), onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }) }); }
export function useDeleteProduct() { const qc = useQueryClient(); return useMutation({ mutationFn: deleteProduct, onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }) }); }
