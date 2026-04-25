# Catalog Decision

## Status
Accepted for current architecture baseline.

## Decision
The project currently uses a hybrid catalog architecture:

- `App\Models\Product` is the authoring source for admin and editorial product data.
- `Lunar\Models\Product` and `Lunar\Models\ProductVariant` are the selling source for storefront, checkout, and order runtime.
- `App\Services\ProductSyncService` is the translation boundary from authoring data into sellable Lunar data.

This means the system is intentionally **legacy-authoring -> Lunar-selling** for now.

## Why
The runtime commerce flow already depends on Lunar for:

- published catalog API
- purchasable variants
- checkout/cart/order creation
- price storage
- order lines and payment/tax/shipping orchestration

Reversing this immediately would be a commerce-engine rewrite, not a normal refactor.

## Immediate rules
1. Storefront and checkout contracts must expose product identity and purchasable identity separately.
2. Frontend cart and checkout payloads must use `variantId` explicitly.
3. Legacy product routes and controllers should be treated as deprecated unless they are still required for compatibility.
4. Legacy variants must either:
   - be synced into real Lunar variants, or
   - be removed from active authoring flows.

## Canonical runtime identities
- `productId`: Lunar product id
- `variantId`: Lunar product variant id
- `slug`: canonical storefront slug from Lunar URL data
- `categorySlug`: canonical collection/category slug used by the storefront route

## Follow-up work
- deprecate `/product/[id]` in favor of `/shop/[category]/[slug]`
- migrate legacy sitemap/review flows away from `App\Models\Product`
- decide whether legacy variant authoring remains supported
