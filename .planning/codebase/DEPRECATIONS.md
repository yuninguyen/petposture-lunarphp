# Deprecations

## Product / Catalog
- Legacy storefront route: `/product/[id]`
  Replacement: `/shop/[category]/[slug]`

- Ambiguous storefront `Product.id`
  Replacement: use explicit `productId` and `variantId`

- Controllers still bound to legacy `App\Models\Product` for customer-facing behavior:

- Legacy review admin/runtime still bound to legacy product review records:
  - `App\Filament\Resources\ReviewResource`
  Note: keep as moderation-only surface, not as manual review authoring flow.

- Legacy commerce service not aligned with active checkout stack:

- Disabled legacy variant admin surface kept only as residue:
  - `App\Filament\Resources\ProductResource\RelationManagers\VariantsRelationManager`

## Settings / Media
- Raw settings CRUD surface:
  - `App\Filament\Resources\SettingResource`
  Replacement: `App\Filament\Pages\ManageSettings`

- Treat `App\Filament\Resources\MediaResource` as a library/inspection tool only until blog and settings assets have a unified media contract.

## Notes
These are not all safe to delete immediately. Some remain compatibility surfaces and should be removed only after route/API migration is complete.
