# Residue Audit

## Status
Working cleanup list after catalog and CMS contract hardening.

## Confirmed residue
- `App\Filament\Resources\ProductResource\RelationManagers\VariantsRelationManager`
  - no longer registered in `ProductResource`
  - reflects disabled legacy multi-variant authoring flow

## Removed residue
- `App\Http\Controllers\Api\ReviewController`
  - removed after route audit confirmed no active API bindings
  - customer-facing review flow stays in `ProductController`

- `App\Services\OrderService`
  - removed after caller audit confirmed no active runtime usage
  - active checkout/order path remains `CheckoutService` plus order operations/state machine

## Still active but legacy-coupled
- `App\Filament\Resources\ReviewResource`
  - still useful as admin review moderation surface
  - still tied to legacy review records and legacy product linkage
  - manual review creation should stay disabled; storefront flow is the canonical ingest path

## Cleanup rule
Soft-deprecate first, then delete only after:
1. there are no active routes or admin links
2. there are no operational users depending on the surface
3. a replacement flow is documented and verified
