# Order, Email, Content, and Admin Follow-ups — Verified Design

**Date:** 2026-09-06
**Status:** Approved for planning; implementation delegated to an external agentic harness

## Purpose

This document records the verified state of the issues reported on 2026-09-06 and locks the intended behavior before implementation plans are handed to Sol 5.6 / DeepSeek. It covers five independent workstreams: customer order history, order emails, comparison-post fields and article tables, React admin order parity, and the remaining React-admin migration.

## Global decisions

- Use the checkout success page as the visual/copy reference for order summaries.
- Display totals as `USD $123.45`: currency code first, then the formatted amount. The currency code should be visually secondary where the UI supports it.
- Use the exact label `Estimated Taxes` in the requested order-summary surfaces.
- `N items` means the sum of product-line quantities, excluding shipping lines, not the number of distinct lines.
- Generic payment copy is `Card`, never `Credit card`, because the funding source may be credit, debit, or prepaid.
- Do not add BIN lookup. Stripe already supplies `card_funding`, `card_brand`, and `card_last4` after payment succeeds. Use those values when present and fall back safely when webhook metadata has not arrived.
- For PayPal, show the PayPal icon/label and `paypal_payer_email` when available. Do not show capture IDs or other gateway identifiers.
- English terminology: use `Customer email` only when a field contains email alone. In the Orders list, the preferred design is a single `Customer` cell with customer name as the primary line and email as the secondary line.
- Keep affiliate reporting separate from the commerce dashboard.
- Keep Goals under Finance, but show goal progress on the commerce dashboard with an `Edit targets` link.
- Finance migration includes Stripe, PayPal, and Airwallex only. Existing Payoneer/PingPong settings are left untouched in storage but are not exposed in the new admin.
- System navigation is core-admin-only and contains Users, Roles, Permissions, Media Library, Settings, Notifications, and Profile access. Customer addresses remain inside Customer detail rather than becoming a top-level System item.
- Every admin UI string added or changed must exist in both `admin/src/locales/en.json` and `admin/src/locales/vi.json`.
- Do not remove Filament until the equivalent React-admin capability is implemented, verified, and has a rollback path.

## Verified workstream A — customer account order details

The relevant file is `frontend/app/account/page.tsx`; there is no `frontend/app/accountpage/tsx` path.

- The active Request a Return control only adds an underline on hover, while checkout success uses a bordered secondary-button treatment. The account control needs visible background/border/shadow or color feedback and a real disabled button for the closed state.
- The account total already contains the currency code, but its typography/order does not match checkout success. Standardize it to currency code followed by amount.
- Shipping and billing phone fields are already serialized and rendered. The real gap is checkout creation of a different billing address: the frontend does not send a phone, so `contact_phone` is null. Use the order contact phone for split billing unless a separate billing phone is intentionally introduced later. Render a shipping-phone fallback for legacy orders with a null billing phone.
- `Subtotal · N items` is already implemented correctly on the account page. Do not rewrite it.
- Change `Estimated Tax` to the approved `Estimated Taxes` label.
- Legacy Filament `ViewOrder.php` already renders address phone, card funding/brand/last4, shipping method, and an action group. Its remaining requested summary parity is item count, currency-code prefix, and tax-label consistency.

## Verified workstream B — order emails

Affected templates:

- `backend/resources/views/mail/cancelled-order-admin.blade.php`
- `backend/resources/views/mail/new-order-admin.blade.php`
- `backend/resources/views/mail/order-delivered.blade.php`
- `backend/resources/views/mail/order-confirmation.blade.php`
- `backend/resources/views/mail/order-cancelled.blade.php`

Findings:

- Only order confirmation currently has a card-brand icon map and card last4 rendering.
- `paypal_payer_email` is already stored in order meta but is not rendered by these templates.
- Order confirmation already displays both address phone values and `Subtotal · N items`; avoid redundant edits there.
- New-order admin and cancelled-order admin omit both address phones. Order-delivered omits the shipped-to phone.
- New-order admin, cancelled-order admin, and customer order-cancelled use a bare Subtotal label.
- Cancelled-order admin and customer order-cancelled omit the shipping-method label.
- Currency placement is inconsistent and sometimes hardcoded. Use the actual `currency_code` with `USD` only as a fallback.
- Payment metadata can arrive after the confirmation email because Stripe card details are webhook-populated. Templates must render `Card` without inventing brand/funding/last4 when metadata is absent.
- Shared Blade presentation partials for address, payment method, and totals are justified because the same inconsistencies repeat across several templates. Do not create a broad mail framework or change mail delivery.
- Keep card icons self-contained in the mail presentation layer. Do not rely on CID embedding because the current Resend transport does not support the previous embed approach.

## Verified workstream C — comparison posts and article tables

- `posts.comparison.image_alt` is referenced by `ComparisonItemRepeater.tsx` but absent from both locale files, so the raw key appears in EN and VI.
- The field is validated, persisted, and returned by the API, but `frontend/components/blog/ComparisonTable.tsx` ignores it and uses product name as image alt text.
- English `posts.comparison.optional_suffix` already contains parentheses while JSX adds another pair. Store the locale value without parentheses.
- TipTap tables render header cells as `<th>` inside `<tbody>`, so the current `[_thead]` background rule never applies.
- `border-collapse` prevents the intended rounded-card appearance, paragraph prose margins inflate cells, and tables have no safe mobile horizontal-scroll wrapper.
- The sanitizer strips `colgroup`, `col`, and width metadata needed for TipTap column sizing. Extend only the narrow allowlist required for table layout and preserve all current XSS protections.
- No database migration is required. Legacy comparison JSON can omit `image_alt` and existing HTML can be rendered with improved styles.

## Verified workstream D — React admin Orders

- The Orders list column labeled Customer renders only `customer_email`. Preferred correction: retain the `Customer` heading but render shipping-address name as the primary line and email beneath it. If no name exists, show email alone.
- Generic `Credit card` originates from the Stripe gateway label, legacy list mapping, and manual-order metadata. Change generic copy to `Card`.
- React admin receives card brand and last4 but not `card_funding`. Expose funding to admin and map it to Credit Card, Debit Card, Prepaid Card, or Card. No BIN lookup.
- PayPal payer email is stored but not exposed to/rendered by the React order detail.
- Items summary lacks `· N items` in both React admin and legacy Filament ViewOrder.
- React detail recomputes money from decimals while list views use the backend formatted value. Establish one currency-aware formatting contract so list/detail/email do not drift.
- Add explicit tests for card funding branches, PayPal fallback/account display, Customer cell rendering, item quantity count, and currency placement.

## Verified P0 — customer/admin API boundary

`GET /api/orders` for authenticated customers and the admin order endpoint currently share `App\\Http\\Resources\\Api\\OrderResource`. The customer response can therefore include staff/internal fields such as `internal_note`, fraud/risk information, customer network/device information, payment intent/gateway event identifiers, and `available_actions`.

This must be fixed before treating cosmetic account-order work as complete:

- Create a customer-safe order resource or conditionally separate admin-only fields with a testable authorization boundary.
- Prefer a dedicated customer resource because it makes the contract explicit and prevents future admin fields from leaking automatically.
- Preserve only fields used by the customer account UI: order identity/status, customer-safe payment summary, totals, product lines/images, addresses, shipment/tracking, timestamps, and return eligibility data.
- Add non-admin authenticated endpoint tests mirroring the existing public tracking-resource leak tests.

## Verified workstream E — mobile admin and migration

### Mobile root cause

- `AppShell.tsx` hides the only sidebar with `hidden md:flex` and has no mobile replacement.
- Core admins are redirected to `/posts`, so a mobile user lands on Posts and has no navigation to other modules.
- Role-based sidebar visibility filters groups by array index, which will break when new Dashboard/System groups are inserted.

### Mobile design

- Add a topbar hamburger and accessible off-canvas drawer using the same single-source navigation data as desktop.
- Drawer must support overlay click, Escape, route-change close, focus management, and body-scroll lock.
- Replace index-based navigation authorization with explicit group keys/capability predicates before adding groups.
- Responsive list/detail behavior is a separate pass after shell navigation: use priority columns or mobile cards rather than assuming horizontal scrolling is sufficient.

### Migration order

1. Mobile shell and semantic navigation authorization.
2. Commerce Dashboard + Goals + current-user Profile.
3. Standalone Media Library and Users CRUD.
4. Affiliate Networks CRUD + separate Affiliate Reports.
5. Finance Payment Methods for Stripe/PayPal/Airwallex with masked secrets and server-side connection tests.
6. Notifications and remaining System settings.
7. Read-only Permissions matrix, then Roles/Permissions editing last.
8. Move client authorization from hardcoded role names to server-provided abilities before custom role editing is enabled.

### Dashboard

- Commerce dashboard should contain the useful currently registered commerce widgets, goal progress, return requests, order pipeline, recent orders, and top products.
- Do not migrate overlapping/unregistered legacy widgets automatically; audit each before porting.
- Affiliate clicks, clicked posts, and network performance stay on `/affiliate/reports`.

### Finance security

- Never return raw gateway secrets to the SPA.
- Read APIs return configured/presence state and optional masked last characters only.
- Update APIs treat an unchanged mask as no change and allow explicit replacement/clearing through deliberate fields.
- Gateway connection tests execute server-side; browser code must never call provider APIs with secrets.

## Plan decomposition

This design must not be implemented as one mega-change. It will be handed off as independent plans:

1. Customer order API boundary (P0).
2. Customer account order UI polish.
3. Order email presentation parity.
4. Comparison post locales/accessibility and article-table rendering.
5. Admin Orders payment/customer/summary parity, including legacy ViewOrder summary parity.
6. Mobile admin shell/navigation.
7. Admin migration roadmap, with each migration phase receiving its own implementation plan before execution.
