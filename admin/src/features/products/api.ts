import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '@/lib/api';
import { fetchBrands, type Brand } from '@/features/brands/api';
import { fetchProductTypes, type ProductType } from '@/features/product-types/api';
import { fetchCollectionTrees, type CollectionGroupTree, type CollectionNode } from '@/features/collections/api';

export type ProductStatus = 'draft' | 'published';
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
export interface Currency { id: number; code: string; decimal_places: number; factor: number }
export interface TaxClass { id: number; name: string }
export interface OptionValue { option_id: number; option_name: string; value_id: number; value_name: string }
export interface ProductVariant {
  id: number; product_id: number; sku: string; gtin: string | null; mpn: string | null; ean: string | null;
  stock: number; backorder: number; purchasable: 'always' | 'in_stock' | 'in_stock_or_on_backorder';
  unit_quantity: number; quantity_increment: number; min_quantity: number; tax_class_id: number;
  tax_ref: string | null; shippable: boolean; length_value: string | number | null; length_unit: string | null;
  width_value: string | number | null; width_unit: string | null; height_value: string | number | null;
  height_unit: string | null; weight_value: string | number | null; weight_unit: string | null;
  base_price: string; formatted_price: string | null; option_values: OptionValue[]; attributes: AttributeDefinition[];
}
export interface ProductDetail {
  id: number; slug: string | null; status: ProductStatus; brand_id: number | null; product_type_id: number;
  product_type: { id: number; name: string }; brand: { id: number; name: string } | null;
  has_variants: boolean; product_attributes: AttributeDefinition[]; variants: ProductVariant[];
  collection_ids: number[]; media: ProductMedia[]; default_currency: Currency; tax_classes: TaxClass[]; updated_at: string | null;
}
export interface ProductSummary {
  id: number; thumbnail: string | null; name: string; description: string; product_type: { id: number; name: string };
  brand: { id: number; name: string } | null; first_collection: { id: number; name: string } | null;
  total_stock: number; price: { amount: number; formatted: string; currency: string } | null;
  status: ProductStatus; created_at: string | null; updated_at: string | null;
}
export interface ProductsPage { data: ProductSummary[]; meta: { current_page: number; last_page: number; per_page: number; total: number } }
export interface ProductFilters { search?: string; status?: ProductStatus | ''; brand_id?: number | ''; product_type_id?: number | ''; page?: number; per_page?: number }
export interface CreateProductPayload { name: string; product_type_id: number; sku: string; base_price: string }
export interface UpdateProductPayload { slug: string; status: ProductStatus; brand_id: number | null; attributes: AttributeValues; collections: number[]; media: Array<{ id: number; source: ProductMedia['source']; alt: string }> }
export interface UpdateVariantPayload {
  sku: string; gtin: string | null; mpn: string | null; ean: string | null; stock: number; backorder: number;
  purchasable: ProductVariant['purchasable']; unit_quantity: number; quantity_increment: number; min_quantity: number;
  tax_class_id: number; tax_ref: string | null; shippable: boolean; length_value: string | null; length_unit: string | null;
  width_value: string | null; width_unit: string | null; height_value: string | null; height_unit: string | null;
  weight_value: string | null; weight_unit: string | null; base_price: string; attributes: AttributeValues;
}
export interface CollectionOption { id: number; label: string }

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
export async function createProduct(payload: CreateProductPayload): Promise<ProductDetail> { return unwrap(await fetchJson<ProductDetail | { data: ProductDetail }>('/admin/products', { method: 'POST', body: { ...payload } })); }
export async function updateProduct(id: number, payload: UpdateProductPayload): Promise<ProductDetail> { return unwrap(await fetchJson<ProductDetail | { data: ProductDetail }>(`/admin/products/${id}`, { method: 'PUT', body: { ...payload } })); }
export async function updateProductVariant(productId: number, variantId: number, payload: UpdateVariantPayload): Promise<ProductVariant> { return unwrap(await fetchJson<ProductVariant | { data: ProductVariant }>(`/admin/products/${productId}/variants/${variantId}`, { method: 'PUT', body: { ...payload } })); }
export async function deleteProduct(id: number): Promise<void> { await fetchJson(`/admin/products/${id}`, { method: 'DELETE' }); }

function flattenNodes(nodes: CollectionNode[], parents: string[] = []): CollectionOption[] {
  return nodes.flatMap((node) => {
    const name = node.name.en || node.name.vi || `#${node.id}`;
    const path = [...parents, name];
    return [{ id: node.id, label: path.join(' / ') }, ...flattenNodes(node.children ?? [], path)];
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
export function useProductLookups() {
  const productTypes = useQuery({ queryKey: ['product-types'], queryFn: fetchProductTypes });
  const brands = useQuery({ queryKey: ['brands'], queryFn: fetchBrands });
  const collections = useQuery({ queryKey: ['collections', 'tree'], queryFn: fetchCollectionTrees });
  return { productTypes: (productTypes.data ?? []) as ProductType[], brands: (brands.data ?? []) as Brand[], collectionOptions: flattenCollectionTrees(collections.data ?? []), isLoading: productTypes.isLoading || brands.isLoading || collections.isLoading };
}
export function useCreateProduct() { const qc = useQueryClient(); return useMutation({ mutationFn: createProduct, onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }) }); }
export function useUpdateProduct() { const qc = useQueryClient(); return useMutation({ mutationFn: ({ id, payload }: { id: number; payload: UpdateProductPayload }) => updateProduct(id, payload), onSuccess: (data) => { qc.setQueryData(['products', data.id], data); qc.invalidateQueries({ queryKey: ['products'] }); } }); }
export function useUpdateProductVariant() { const qc = useQueryClient(); return useMutation({ mutationFn: ({ productId, variantId, payload }: { productId: number; variantId: number; payload: UpdateVariantPayload }) => updateProductVariant(productId, variantId, payload), onSuccess: (_data, variables) => { qc.invalidateQueries({ queryKey: ['products', variables.productId] }); qc.invalidateQueries({ queryKey: ['products'] }); } }); }
export function useDeleteProduct() { const qc = useQueryClient(); return useMutation({ mutationFn: deleteProduct, onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }) }); }
