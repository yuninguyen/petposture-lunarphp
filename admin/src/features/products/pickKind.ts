import type { AttributeDefinition, ProductKind } from './api';

// A Pick is a product with a retailer link. These fields only mean something on a Pick, so a Shop product does not
// show them (and nobody types an affiliate link into a product PetPosture sells itself). The list is the one the
// Pick attribute migrations add; other attributes stay visible on every product.
export const PICK_PRODUCT_HANDLES = ['external_url', 'affiliate_network_slug', 'reference_price', 'price_checked_date', 'best_for_breeds', 'pros', 'cons', 'our_take', 'best_for_note', 'problem', 'approach', 'quick_specs', 'second_retailer_slug', 'second_retailer_url'];
export const PICK_VARIANT_HANDLES = ['external_url', 'reference_price'];

export function isWebUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());

    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname !== '';
  } catch {
    return false;
  }
}

/** The translation key of what is wrong with a Pick's retailer link, or null when it is fine. */
export function retailerLinkError(value: string): string | null {
  if (value.trim() === '') return 'products.validation.pick_link_required';

  return isWebUrl(value) ? null : 'products.validation.pick_link_invalid';
}

/** What is sent to create a product: a Shop product has no retailer link, even if one was typed before the kind was switched. */
export function createProductPayload<T extends { kind: ProductKind; external_url: string }>(values: T): T {
  return values.kind === 'shop' ? { ...values, external_url: '' } : { ...values, external_url: values.external_url.trim() };
}

/** The product fields to show: a Pick shows all of them with the retailer link required, a Shop product hides the Pick ones. */
export function productFieldsFor(definitions: AttributeDefinition[], isPick: boolean): AttributeDefinition[] {
  if (!isPick) return definitions.filter((definition) => !PICK_PRODUCT_HANDLES.includes(definition.handle));

  return definitions.map((definition) => (definition.handle === 'external_url' ? { ...definition, required: true } : definition));
}

/** The variant fields to show: the retailer link and price of a variant only belong to a Pick. */
export function variantFieldsFor(definitions: AttributeDefinition[], isPick: boolean): AttributeDefinition[] {
  return isPick ? definitions : definitions.filter((definition) => !PICK_VARIANT_HANDLES.includes(definition.handle));
}
