# Admin Discounts — Shopify-style 4 Discount Types

## Context

The admin currently supports exactly one discount shape: `Lunar\DiscountTypes\AmountOff` applied to the whole order (fixed USD or percentage, optional min order value, coupon-gated). `DiscountController.php`'s `TYPES` const hardcodes this as the only registered type, and `DiscountFormPage.tsx` is one flat form with no type selector.

User wants to move toward Shopify's 4 discount types (reference screenshots, 2026-09-13):
1. **Amount off products** — Percentage/Fixed, scoped to specific products or collections.
2. **Buy X get Y** — buy N of set A, get M of set B at a reward value.
3. **Amount off order** — Percentage/Fixed, whole order (this is what we have today).
4. **Free shipping** — zeroes shipping cost on the order.

## Verified facts (read from vendor + app code, 2026-09-13 — do not re-derive, trust these)

- `vendor/lunarphp/core/src/DiscountTypes/AmountOff.php` **already implements product/collection scoping**: it reads `$discount->collections->where('pivot.type', 'limitation')` and `$discount->discountableLimitations` (+ `exclusion` counterparts) to restrict which lines the discount applies to. If neither is populated, it discounts the whole cart. **This means "Amount off products" and "Amount off order" are the SAME underlying `type` class** — they differ only in whether limitation rows exist. No new discount type registration needed for either.
- `Lunar\Models\Discount` relations available: `collections()` (belongsToMany, pivot `type`: `limitation`/`exclusion`), `discountables()`/`discountableConditions()`/`discountableExclusions()`/`discountableLimitations()`/`discountableRewards()` (all `HasMany` on `Discountable`, a polymorphic `discountable_type`/`discountable_id` + `type` row scoped to Product or ProductVariant).
- `vendor/lunarphp/core/src/DiscountTypes/BuyXGetY.php` **exists in vendor** and is functional: reads `$discount->discountableConditions` (the "buy" set) and `data.min_qty`/`data.reward_qty`/`data.max_reward_qty`/`data.automatically_add_rewards`, matches against `discountableRewards` (the "get" set — Product/ProductVariant only, no collection support confirmed in this class), and **always makes the full reward-line unit price the discount** (`$lineDiscountTotal = $unitPrice * $qtyToAllocate`). **There is no percentage or "amount off each" reward option in vendor code as written — reward items are always 100% free.** Shopify's "At a discounted value: Percentage / Amount off each / Free" only cleanly maps to "Free". Percentage/amount-off-each would require overriding/extending this vendor class — out of scope for the first pass unless the user explicitly asks after seeing "Free" ship.
- `DiscountController.php`'s validation array **already has dead/unused fields** for `data.min_qty`, `data.reward_qty`, `data.max_reward_qty`, `data.automatically_add_rewards` — presumably scaffolded for a BuyXGetY pass that was never finished. `TYPES` const and `isSupported()` only allow `AmountOff::class` today; these fields are validated but never read into `attributes()`/`normalizedData()`.
- **Free shipping already has a live runtime hook** in `app/Lunar/ShippingModifiers/DefaultShippingModifier.php`: it looks up the active `Discount` matching the cart's `coupon_code` and reads `$discount->data['free_shipping']` (boolean) to zero every shipping rate via `ShippingService::rateFor(..., $isFreeShipping)`. **This is dead code today** because no admin path ever sets `data.free_shipping = true`. No vendor `FreeShipping` discount-type class exists — the cheapest correct approach is a thin no-op `App\DiscountTypes\FreeShipping` type (implements `Lunar\Base\DiscountTypeInterface`/extends `AbstractDiscountType`, `apply()` returns `$cart` unchanged) purely so it has its own `type_label` and shows up distinctly in the discounts list, while `DefaultShippingModifier` keeps working exactly as it already does.
- Reusable frontend component: `admin/src/components/ui/SearchableMultiSelect.tsx`, already used in `OrderFormPage.tsx` for product/variant picking — reuse for all "pick products/collections" UI here rather than building a new picker.
- `admin/src/features/discounts/api.ts` currently has one flat `DiscountFormValues` shape and `buildDiscountPayload`/`buildDiscountUpdatePayload` — will need a `type` field threaded through and type-specific payload branches.

## Explicitly out of scope for this plan (confirm with user only if they ask for it later)

- **"Method: Discount code / Automatic discount" toggle.** `coupon` is a required, unique field end-to-end today (backend validation, cart lookup by `coupon_code`). Automatic (codeless, auto-applied) discounts need new cart-apply logic to find applicable discounts without a code — a separate, larger feature. Keep `coupon` required for all 4 types in this plan.
- **"Sales channel access", "Tags", "Countries" (shipping destinations).** Site is single-channel, ships US only. Shopify shows these because it's multi-channel/multi-country; not applicable here.
- **"Combinations" (per-discount combinability rules).** Lunar already has `priority` (evaluation order) and `stop` (halt further discount evaluation) on every discount — keep using those rather than building Shopify's combinability picker. Task 0 below just relabels/regroups the existing fields more clearly; it does not add new combinability logic.
- **Percentage/"Amount off each" reward value for Buy X get Y** (see verified facts above) — ship "Free" only in the first pass.

## Global Constraints

- Every new/changed backend endpoint needs a feature test using `Sanctum::actingAs()` (this codebase's established convention — confirmed in `CheckoutApiTest.php`, `DashboardSalesControllerTest.php` etc.), covering: role permission (only core-admin + whichever roles already manage discounts today — check current `role:` middleware on the discounts routes before assuming), validation errors, and at least one real cart-apply test proving the discount actually behaves as configured (not just that the row saves).
- Money in `data.*` fields stays in **minor units (cents)** in the DB, same as `AmountOff` today (`minor()`/`decimal()` helpers in `DiscountController.php`) — don't introduce a different unit convention for new types.
- Don't change the existing `AmountOff` whole-order behavior for existing discounts — Task 1 only adds the ability to attach product/collection scoping, it must remain optional (no scoping = whole order, exactly like today).
- Reuse `SearchableMultiSelect` for every product/collection picker; don't build a second picker component.
- Follow this session's established verification discipline: real branch, real `php artisan test` + `npm run test -- --run` + `npx tsc --noEmit` + `npm run build`, real browser check via chrome-devtools MCP, before considering any task done.

## Execute in this order

Task 1 (Amount off products) has the least backend risk (extends an already-working type) and the highest value (most common discount shape). Task 3 (Free shipping) is next — the shipping-side is already live, only admin CRUD is missing. Task 2 (Amount off order UI split) is almost free once Task 1's type-selector UI exists. Task 4 (Buy X get Y) is last — the most new backend wiring and the one place we're deliberately shipping less than Shopify's full option set (Free only).

---

### Task 1: Backend — Amount off products (collection/product scoping on AmountOff)

**Files:** `backend/app/Http/Controllers/Api/Admin/DiscountController.php`, `backend/tests/Feature/Api/Admin/DiscountControllerTest.php` (read this file in full first — it already exists per GitNexus symbol search, confirm its current role-gate and test-data conventions before adding cases).

- [ ] Add `applies_to` to the request shape: `all_products | specific_collections | specific_products`, plus `collection_ids: int[]` / `product_ids: int[]` depending on choice. Validate collection/product IDs exist.
- [ ] On store/update: when `applies_to !== 'all_products'`, sync `$discount->collections()` with pivot `type = 'limitation'` for the chosen collections, and create/replace `Discountable` rows (`discount->discountableLimitations()`, `discountable_type = Product::morphName()`) for chosen products. When `applies_to === 'all_products'`, clear both (detach collections with type=limitation, delete existing limitation Discountables) so it reverts to whole-catalog scope — but scope deletes/detaches to `type=limitation` only, don't touch `exclusion`-type rows even though none exist today.
- [ ] Extend `resource()`/`dataForResponse()` to include `applies_to` + the resolved collection/product IDs (and ideally names, so the edit UI doesn't need N+1 lookups) so the frontend can rehydrate the edit form.
- [ ] Tests: create with each of the 3 `applies_to` values persists the right rows; update from `specific_collections` to `all_products` clears the limitation rows; a cart-apply test (extend or mirror an existing checkout test) proving a line for an out-of-scope product is NOT discounted while an in-scope one is.

### Task 1: Frontend — Amount off products

**Files:** `admin/src/features/discounts/api.ts`, `admin/src/features/discounts/DiscountFormPage.tsx`.

- [ ] Add a "Type" selector at the top of Create (Amount off products / Buy X get Y / Amount off order / Free shipping) — only shown on create; on edit, the type is fixed and shown read-only (matches Shopify's own behavior — type can't be changed after creation).
- [ ] For "Amount off products": add "Applies to" dropdown (All products / Specific collections / Specific products) + `SearchableMultiSelect` wired to the existing collections/products list endpoints (check `admin/src/features/collections/api.ts` and `admin/src/features/products/api.ts` for a search-capable list call to reuse, rather than adding a new one).
- [ ] Rework "Minimum purchase requirements" from the single `min_price_usd` number field into a 3-way radio (No minimum / Minimum purchase amount / Minimum quantity of items) — check `AmountOff.php`'s `apply()` for whether it reads any quantity threshold before promising this in the UI; if it doesn't, either skip that radio option for Amount off types or note it as a follow-up backend task, don't silently build a UI control with no backend effect.
- [ ] Rework "Maximum discount uses" into two checkboxes that reveal their number input when checked (currently both `max_uses`/`max_uses_per_user` fields are always-visible number inputs) — cosmetic only, same fields.
- [ ] Rework "Active dates" so "End date" is a checkbox that reveals the end datetime picker when checked, defaulting to no end date (currently `ends_at` is always an optional field with no explicit affordance).
- [ ] Update `buildDiscountPayload`/`buildDiscountUpdatePayload` and `valuesFromDiscount` for the new `applies_to`/`collection_ids`/`product_ids` fields.

### Task 2: Amount off order (UI differentiation only)

**Files:** `admin/src/features/discounts/DiscountFormPage.tsx`, wherever the discounts list's "Type" column renders, `DiscountController.php`'s `resource()`.

- [ ] When the user picks "Amount off order" as the type, hide the "Applies to" section entirely (implicitly `applies_to = all_products`, no picker shown) — same backend type, same payload, just a narrower form.
- [ ] In `resource()`, compute a display-only `type_label` of "Amount off products" vs "Amount off order" based on whether limitation rows exist, so the list page and edit-page badge match Shopify's distinction even though it's one underlying Lunar type.
- [ ] No new backend validation/logic beyond what Task 1 already added — this task is UI-only, keep it small.

### Task 3: Free shipping

**Files:** new `backend/app/DiscountTypes/FreeShipping.php`, `DiscountController.php`, `admin/src/features/discounts/`, checkout/cart feature tests.

- [x] Create `App\DiscountTypes\FreeShipping` (check whether vendor discount types extend `AbstractDiscountType` or implement `DiscountTypeInterface` directly and mirror that exact pattern) with a no-op `apply(CartContract $cart): CartContract { return $cart; }` and `getName()`. The actual shipping-zeroing logic already lives in `DefaultShippingModifier` and reads `data.free_shipping` directly off the coupon-matched `Discount` row — this class exists purely to register a distinct, correct `type` for the discounts list/API, not to do the zeroing itself.
- [x] Register `App\DiscountTypes\FreeShipping::class => 'Free shipping'` in `DiscountController::TYPES`, add it to `isSupported()`, and always set `data.free_shipping = true` when persisting this type (no user-facing toggle needed — the type IS the flag).
- [x] Frontend: new type option; when selected, skip the "Discount value" section entirely (Shopify's Free shipping screen has no Discount value section, only conditions: min purchase, usage limits, dates). Shopify also shows "Shipping rates: Exclude shipping rates over a certain amount" — check whether this maps to anything; `ShippingService::rateFor` already has a separate, pre-existing `free_over`-per-`ShippingMethod` mechanism, don't conflate the two. Treat "exclude rates over X" as a stretch goal, not required for the first pass.
- [x] Tests: create a Free shipping discount, apply its coupon to a cart via the checkout API, assert the shipping line/rate is 0 — this exercises `DefaultShippingModifier`'s existing (currently untested from the admin-creation side) logic end to end.

### Task 4: Buy X get Y

**Files:** `DiscountController.php`, `admin/src/features/discounts/api.ts`, `DiscountFormPage.tsx`.

- [ ] Register `\Lunar\DiscountTypes\BuyXGetY::class => 'Buy X get Y'` in `TYPES`/`isSupported()`.
- [ ] Wire the already-scaffolded-but-unused `data.min_qty`/`data.reward_qty`/`data.max_reward_qty`/`data.automatically_add_rewards` validation rules into `attributes()`/`normalizedData()`/`dataForResponse()` for this type (currently validated but discarded).
- [ ] Read the rest of `BuyXGetY.php` (only the `Product`/`ProductVariant` matching branches of `discountableConditions`/`discountableRewards` were confirmed during planning) before deciding whether collection-based conditions are supported by this vendor class at all. If not supported, ship product-only pickers for both "Customer buys" and "Customer gets" rather than building a collection picker with no backend effect.
- [ ] Persist "Customer buys" as `discountableConditions` (type=`condition`) and "Customer gets" as `discountableRewards` (type=`reward`), scoped per the previous point's finding.
- [ ] Frontend: two `SearchableMultiSelect` blocks (Customer buys / Customer gets) each with a quantity field; reward value UI shows **only "Free"** (per verified facts above) — do not offer Percentage/Amount off each unless the vendor class is extended first; if the user wants those, flag it as new backend work rather than building dead UI.
- [ ] Tests: create a Buy X get Y discount, add matching lines to a cart via the checkout API, assert the reward line is discounted to 0 per `BuyXGetY::getRewardQuantity()`'s formula (`floor(linesQuantity / minQty) * rewardQty`, capped by `maxRewardQty`).

## Release gate (all 4 tasks)

- [ ] `php artisan test` green (backend), `npm run test -- --run` + `npx tsc --noEmit` + `npm run build` green (admin).
- [ ] Real browser check per type: create one discount of each of the 4 types, verify the list page shows the right `type_label`, edit each and confirm the form rehydrates correctly (especially product/collection selections), and run one real cart-apply per type (add matching products to a cart on the storefront/checkout flow, apply the coupon, confirm the right total/shipping change).
- [ ] Confirm with the user before merging to `main` and deploying, per this project's established workflow.
