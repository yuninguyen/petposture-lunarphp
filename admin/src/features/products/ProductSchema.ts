import { z } from 'zod';
import type { AttributeDefinition, AttributeValues, ProductDetail, ProductVariant, UpdateProductPayload, UpdateVariantPayload } from './api';

const optionalText = z.string().trim().transform((value) => value || null);
const optionalNumberText = z.string().trim().refine((value) => value === '' || (!Number.isNaN(Number(value)) && Number(value) >= 0), 'products.validation.non_negative').transform((value) => value || null);

export const createProductSchema = z.object({
  name: z.string().trim().min(1, 'products.validation.name_required').max(255, 'products.validation.max_255'),
  product_type_id: z.coerce.number().int().positive('products.validation.product_type_required'),
  sku: z.string().trim().min(1, 'products.validation.sku_required').max(255, 'products.validation.max_255'),
  base_price: z.string().trim().min(1, 'products.validation.price_required').refine((value) => !Number.isNaN(Number(value)) && Number(value) >= 0, 'products.validation.non_negative'),
});
export type CreateProductValues = z.input<typeof createProductSchema>;

export const productFormSchema = z.object({
  status: z.enum(['draft', 'published']),
  brand_id: z.union([z.number().int().positive(), z.null()]),
  attributes: z.record(z.union([z.string(), z.object({ en: z.string(), vi: z.string() })])),
  collections: z.array(z.number().int().positive()),
  media: z.array(z.object({ id: z.string(), url: z.string(), source: z.enum(['spatie', 'curator']) })),
});
export type ProductFormValues = z.infer<typeof productFormSchema>;

export const variantFormSchema = z.object({
  sku: z.string().trim().min(1, 'products.validation.sku_required').max(255),
  gtin: optionalText, mpn: optionalText, ean: optionalText,
  stock: z.coerce.number().int().min(0), backorder: z.coerce.number().int().min(0),
  purchasable: z.enum(['always', 'in_stock', 'in_stock_or_on_backorder']),
  unit_quantity: z.coerce.number().int().min(1), quantity_increment: z.coerce.number().int().min(1), min_quantity: z.coerce.number().int().min(1),
  tax_class_id: z.coerce.number().int().positive(), tax_ref: optionalText, shippable: z.boolean(),
  length_value: optionalNumberText, length_unit: z.string().nullable(), width_value: optionalNumberText, width_unit: z.string().nullable(),
  height_value: optionalNumberText, height_unit: z.string().nullable(), weight_value: optionalNumberText, weight_unit: z.string().nullable(),
  base_price: z.string().trim().refine((value) => value !== '' && !Number.isNaN(Number(value)) && Number(value) >= 0, 'products.validation.non_negative'),
  attributes: z.record(z.union([z.string(), z.object({ en: z.string(), vi: z.string() })])),
});
export type VariantFormValues = z.input<typeof variantFormSchema>;

export function validateRequiredAttributes(definitions: AttributeDefinition[], values: AttributeValues): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const definition of definitions) {
    if (!definition.required) continue;
    const value = values[definition.handle];
    if (definition.type === 'translated_text') {
      const translated = typeof value === 'object' ? value : { en: '', vi: '' };
      if (!translated.en.trim()) errors[`${definition.handle}.en`] = 'products.validation.required';
      if (!translated.vi.trim()) errors[`${definition.handle}.vi`] = 'products.validation.required';
    } else if (typeof value !== 'string' || !value.trim()) errors[definition.handle] = 'products.validation.required';
  }
  return errors;
}
export function productDefaults(product: ProductDetail): ProductFormValues { return { status: product.status, brand_id: product.brand_id, attributes: Object.fromEntries(product.product_attributes.map((a) => [a.handle, a.value])), collections: product.collection_ids, media: product.media }; }
export function productPayload(values: ProductFormValues): UpdateProductPayload { return { status: values.status, brand_id: values.brand_id, attributes: values.attributes, collections: values.collections, media: values.media.map((media) => ({ id: Number(media.id), source: media.source })) }; }
export function variantDefaults(variant: ProductVariant): VariantFormValues { return { sku: variant.sku, gtin: variant.gtin ?? '', mpn: variant.mpn ?? '', ean: variant.ean ?? '', stock: variant.stock, backorder: variant.backorder, purchasable: variant.purchasable, unit_quantity: variant.unit_quantity, quantity_increment: variant.quantity_increment, min_quantity: variant.min_quantity, tax_class_id: variant.tax_class_id, tax_ref: variant.tax_ref ?? '', shippable: variant.shippable, length_value: String(variant.length_value ?? ''), length_unit: variant.length_unit, width_value: String(variant.width_value ?? ''), width_unit: variant.width_unit, height_value: String(variant.height_value ?? ''), height_unit: variant.height_unit, weight_value: String(variant.weight_value ?? ''), weight_unit: variant.weight_unit, base_price: variant.base_price, attributes: Object.fromEntries(variant.attributes.map((a) => [a.handle, a.value])) }; }
export function variantPayload(values: z.output<typeof variantFormSchema>): UpdateVariantPayload { return values as UpdateVariantPayload; }
