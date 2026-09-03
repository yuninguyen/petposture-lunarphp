# Commerce React Admin Migration Plan

**Status:** Approved  
**Target UI:** `admin.petposture.com`  
**Backend/API and legacy Filament:** `api.petposture.com`  
**Strategy:** Incremental strangler migration

## 1. Objective

Move the Commerce administration UI from the Laravel Filament panel to the existing React/Vite Admin application while retaining Laravel and Lunar as the authoritative owners of:

- APIs and validation
- Database and commerce models
- Business rules and state transitions
- Authentication and authorization
- Pricing, discounts, shipping, returns, and refunds
- Transactions, audit events, notifications, and external integrations

This is not a redirect, iframe integration, Livewire proxy, or migration of backend commerce logic to Vite.

## 2. Target architecture

```text
admin.petposture.com
└── React + TypeScript + Vite
    ├── Content
    ├── Catalogue
    └── Commerce
        ├── Orders
        ├── Return Requests
        ├── Customer Reviews
        ├── Customers
        ├── Discounts
        └── Shipping

api.petposture.com
└── Laravel + Lunar
    ├── Sanctum stateful authentication
    ├── Spatie permissions and policies
    ├── Versioned Admin Commerce APIs
    ├── Commerce domain and database
    ├── Payment/refund/shipping integrations
    └── Legacy Filament fallback
```

### Responsibility boundary

React owns presentation, navigation, client state, translations, tables, filters, forms, drawers, and detail pages.

Laravel/Lunar owns validation, authorization, state machines, pricing, shipping and discount rules, payment/refund operations, audit records, and side effects. React must not duplicate Lunar business rules.

## 3. Routes and navigation

### React routes

```text
/commerce/orders
/commerce/orders/:id
/commerce/returns
/commerce/reviews
/commerce/customers
/commerce/customers/:id
/commerce/shipping
/commerce/discounts
/commerce/discounts/:id
```

The hostname already identifies the Admin application, so routes do not need another `/admin` prefix.

### API namespace

```text
/api/v1/admin/commerce/reviews
/api/v1/admin/commerce/orders
/api/v1/admin/commerce/returns
/api/v1/admin/commerce/customers
/api/v1/admin/commerce/shipping-methods
/api/v1/admin/commerce/discounts
```

New Commerce routes must not be mounted accidentally beneath both `/api` and `/api/v1`. Existing Content and Catalogue APIs do not need to be migrated as a prerequisite.

### Navigation order

```text
Commerce
├── Orders
├── Return Requests
├── Customer Reviews
├── Customers
├── Discounts
└── Shipping
```

Commerce begins as a collapsible navigation group without an Overview page. An overview and aggregate work badge can be considered after Orders, Returns, and Reviews are stable.

## 4. Customer Groups decision

Customer Groups will not have a React route, API, or navigation item.

Lunar must retain one hidden default group:

```text
name: Retail
handle: retail
default: true
```

Do not remove the Customer Group model, tables, pivots, nullable `customer_group_id` price identity, or the Retail record. Lunar uses the default group for storefront context, pricing, discounts, and product/collection availability.

Required safeguards:

- Prevent operators from deleting Retail, changing its handle, or unsetting it as default.
- Verify exactly one default Retail group exists.
- Verify published products and storefront collections have active Retail availability pivots.
- Preserve group-specific, tier, and foreign-currency prices during base-price updates, even though the React UI only exposes the global base price.

## 5. Phase 0 — Security and platform groundwork

### 5.1 GitNexus prerequisite

The GitNexus index was stale at the time of architecture review. Before implementation:

1. Reanalyze the repository and verify index freshness.
2. Run upstream impact analysis for every function, class, or method that will be edited.
3. Report direct callers, affected execution flows, and risk level.
4. Warn before editing any HIGH or CRITICAL-risk symbol.
5. Run GitNexus change detection before committing.

### 5.2 Shared cookie authentication

Replace the React Admin bearer token stored in `localStorage` with Sanctum stateful session authentication shared between:

```text
admin.petposture.com
api.petposture.com
```

Review and configure:

```text
SESSION_DOMAIN=.petposture.com
SANCTUM_STATEFUL_DOMAINS=admin.petposture.com
CORS_ALLOWED_ORIGINS=https://admin.petposture.com
supports_credentials=true
Secure=true
HttpOnly=true
SameSite appropriate for the topology
```

Expected flow:

```text
GET CSRF cookie
→ POST login
→ Laravel creates session
→ React sends API requests with credentials: include
```

Requirements:

- Filament and React can share the authenticated session.
- Backend checks `is_active`.
- Logout invalidates the server session.
- Content, Catalogue, and Commerce use one auth client.
- A long-lived bearer token is not retained in `localStorage`.

### 5.3 Authorization foundation

Do not use broad role middleware as the sole authorization boundary. The target model is:

- Spatie permissions and Laravel policies authorize each resource/action.
- Pilot allowlists control rollout but never replace permissions.
- React may hide controls based on capabilities, but the backend remains authoritative.
- The backend does not serialize fields the caller is unauthorized to see.

### 5.4 Separate Order trust boundaries

The current order resource is shared across staff and customer contexts and can expose internal fields. Replace it with explicit contracts:

```text
AdminOrderSummaryResource
AdminOrderDetailResource
CustomerOrderResource
```

Customer-facing contracts must exclude internal notes, gateway bookkeeping, provider diagnostics, admin actions, internal events, and bearer-like payment session identifiers. Add storefront/account regression tests before rollout.

### 5.5 Commerce shell

- Add the Commerce navigation group.
- Add route and capability guards.
- Add feature flag/allowlist infrastructure.
- Add Vietnamese and English i18next keys.
- Do not add an Overview page initially.
- Unmigrated modules remain hidden or use permission-gated legacy links.

## 6. Phase 1 — Customer Reviews moderation pilot

The current system has no moderation status. Submitted reviews are immediately public, and `is_verified` is incorrectly treated in the storefront as though every reviewer were verified.

### 6.1 Domain changes

Add:

```text
status: pending | approved | rejected
moderated_at nullable
moderated_by nullable
rejection_reason nullable
deleted_at nullable
```

Keep `is_verified` for future verified-purchase automation, but do not expose it as a manual moderator control in this phase.

Valid transitions:

```text
pending  → approved | rejected
approved → pending
rejected → pending
```

Do not transition directly between approved and rejected; return the review to pending first.

### 6.2 Permissions

```text
view_any_review
view_review
moderate_review
delete_review
delete_any_review
restore_review
force_delete_review
```

Approve, reject, and reopen require `moderate_review`. Soft delete and permanent deletion remain separate capabilities.

### 6.3 Admin API

```text
GET    /api/v1/admin/commerce/reviews
GET    /api/v1/admin/commerce/reviews/{id}
POST   /api/v1/admin/commerce/reviews/{id}/approve
POST   /api/v1/admin/commerce/reviews/{id}/reject
POST   /api/v1/admin/commerce/reviews/{id}/reopen
DELETE /api/v1/admin/commerce/reviews/{id}
POST   /api/v1/admin/commerce/reviews/{id}/restore
DELETE /api/v1/admin/commerce/reviews/{id}/force
```

The list contract includes server pagination, status counts, status and product filters, customer search, and sorting. Return an explicit API resource rather than raw Eloquent models.

### 6.4 React UX

Route:

```text
/commerce/reviews
```

Tabs:

```text
Pending
Approved
Rejected
All
```

Pending is the default. Show its count beside the Customer Reviews navigation item.

Open reviews in a detail drawer containing product, customer name, rating, comment, submission time, status, moderator/time, optional rejection reason, and applicable actions. Review content is immutable; moderators may approve, reject, reopen, or delete but cannot rewrite the customer submission.

Support deep links:

```text
/commerce/reviews?status=pending&review=<id>
```

### 6.5 Storefront behavior

- Public submissions create `pending` reviews.
- Show a clear “awaiting moderation” confirmation.
- Do not refetch and display the pending review as published.
- Public listing returns only approved reviews.
- Rating average, count, and histogram use only approved reviews.
- Do not show “Verified Owner” unless verification is real.
- Improve validation and error feedback.

### 6.6 Spam controls

- Add a honeypot.
- Add a review-specific rate limit by IP/product.
- Keep server-side validation.
- CAPTCHA and verified-purchaser-only submission are out of scope for this pilot.

### 6.7 Notifications and legacy UI

New-review notifications link to:

```text
https://admin.petposture.com/commerce/reviews?status=pending&review=<id>
```

When the pilot opens:

- Hide Customer Reviews from Filament navigation.
- Block Filament mutations.
- Retain a super-admin read-only legacy view for investigation and rollback.

### 6.8 Verification

Backend tests cover submission, public visibility, transitions, invalid transitions, permissions, audit fields, deletion/restore, filtering, pagination, spam controls, and notification URLs.

React tests cover tabs, counts, drawer states, actions, permission gating, confirmations, loading/empty/error states, and deep links.

Required E2E flow:

```text
public submit
→ pending in React Admin
→ approve
→ visible on storefront
→ reopen/reject
→ removed from storefront
```

## 7. Phase 2 — Orders read-only

### 7.1 API

```text
GET /api/v1/admin/commerce/orders
GET /api/v1/admin/commerce/orders/{id}
```

Do not reuse the customer `/api/orders` contract.

Summary rows include reference, date, customer display name, permission-gated email, money/currency, order/payment/fulfillment statuses, payment method, latest shipment/tracking, active return indicator, and a permission-gated legacy URL.

Detail includes items and totals, customer/contact, billing and shipping addresses, payment summary, masked card data, normalized shipments, return/refund summaries, notes, timeline, and permission-gated risk/diagnostic data. Never expose `client_secret`.

### 7.2 Orders list

Route:

```text
/commerce/orders
```

Initial filters:

- Search by reference, customer name, or email.
- Order status.
- Payment status.
- Fulfillment status.
- Created date range.
- Server pagination and allowlisted sorting.
- URL-backed filters.

Do not add bulk-selection checkboxes until a concrete safe bulk action exists.

### 7.3 Order detail

Route:

```text
/commerce/orders/:id
```

Single-page sections:

1. Header summary.
2. Items and totals.
3. Customer and contact.
4. Addresses.
5. Payment.
6. Fulfillment and shipments.
7. Returns and refunds.
8. Notes.
9. Timeline.

### 7.4 Sensitive-field permissions

```text
view_order
view_order_contact
view_order_internal_notes
view_order_risk
view_order_payment_diagnostics
```

Conditional serialization occurs on the backend, not only through frontend hiding.

### 7.5 Timeline

- Use normalized `order_events` as the primary source.
- Read legacy `meta.order_events` only when necessary.
- Normalize event shapes, tag their internal source, deduplicate, and stable-sort by occurrence time.
- Do not concatenate normalized and legacy events blindly.

### 7.6 Legacy fallback

Show “Open legacy admin” only on Order detail and only to users with the required permission. The API returns the configured URL, for example:

```text
https://api.petposture.com/admin/orders/{id}
```

React must not hard-code the backend origin.

## 8. Phase 3 — Order internal notes

First Order mutation:

```text
PATCH /api/v1/admin/commerce/orders/{id}/internal-note
```

Requirements:

- Dedicated permission.
- Application service boundary.
- Audit event.
- Optimistic concurrency or `updated_at` precondition.
- No exposure through customer/public resources.

Controlled state transitions are evaluated only after this phase is stable.

## 9. Phase 4 — Return Requests

Route:

```text
/commerce/returns
```

Returns have a separate operational queue and also appear as summaries/links within Order detail.

Migration sequence:

1. Read-only list/detail.
2. Approve/reject.
3. Completion and return tracking.
4. Restocking/refund calculations.
5. Financial operations.

Orders and Returns must share application services and resources rather than duplicate business logic.

## 10. Phase 5 — Customers read-only

```text
/commerce/customers
/commerce/customers/:id
```

Initial scope:

- Search and list.
- Customer profile.
- Contact information.
- Addresses.
- Order history summary.
- Return summary.
- App User/Lunar Customer linkage status.

Do not initially support create, delete, arbitrary profile mutation, or Customer Group assignment. Before editing is introduced, establish field ownership between the app User, Lunar Customer, Lunar addresses, and immutable Order snapshots.

## 11. Phase 6 — Shipping

Navigation labels:

```text
vi: Vận chuyển
en: Shipping
```

Migration sequence:

```text
Read-only configuration
→ edit existing methods/costs
→ create/delete
```

Shipping mutations require validation, audit, checkout regression tests, and guards against removing methods still used by active carts or orders.

## 12. Phase 7 — Discounts

Migration sequence:

```text
Read-only list/detail
→ audit discount types in actual use
→ support required types in React
→ retain complex or unused Lunar rules in Filament
```

Do not build a generic visual Lunar rule builder solely for vendor parity. Initial create/edit operations use permission-gated legacy deep links.

The audit should cover coupon types, fixed/percentage discounts, dates, usage limits, product/collection eligibility, shipping discounts, Customer Group dependencies, stackability, and current active data.

## 13. Phase 8 — Higher-risk Order mutations

Implement in ascending risk order:

1. Internal notes.
2. Controlled status transitions.
3. Shipment creation and partial allocations.
4. AfterShip integration.
5. Return completion.
6. Mark returned.
7. Partial/full refunds.
8. Cancellation with automatic refund.

Financial mutations require dedicated permissions, required reasons, amount caps, gateway validation, idempotency keys, double-submit protection, reconciliation, immutable audit, retry-safe side effects, and separate Stripe/PayPal coverage.

## 14. Rollout strategy

Each slice follows:

```text
build
→ automated tests
→ staging
→ dark production deployment
→ super-admin smoke test
→ allowlisted operators
→ observation period
→ permission-based rollout
→ hide the matching Filament navigation item
```

Do not immediately delete Filament routes.

A module reaches operational parity when daily workflows run in React, permissions and audit behavior are verified, API contracts are stable, relevant E2E/storefront/checkout tests pass, rollback and legacy deep links work, and no common operation requires Filament.

## 15. Commerce completion criteria

The migration is complete when:

- Operators no longer need Filament for daily Commerce workflows.
- React Commerce is consistent with the Content/Catalogue design system.
- Shared cookie authentication is stable.
- Backend authorization is capability-based rather than role-only.
- Sensitive data is correctly gated and redacted.
- Reviews have real moderation.
- Admin and customer Order contracts are separate.
- Returns, Customers, Shipping, and Discounts have operational parity.
- Storefront, cart, and checkout regression suites pass.
- Legacy usage is limited to rollback or rare capabilities.

Completion does not require immediate removal of all Filament Commerce routes or 100% parity with every Lunar vendor capability. Filament decommissioning is a separate decision gate after stable production evidence.

## 16. Principal risks

1. Authentication migration affects the entire React Admin.
2. The current Order API crosses customer/staff trust boundaries.
3. API role gates and Filament permission policies are inconsistent.
4. Refund and shipment operations have external side effects.
5. Discounts depend on Lunar vendor behavior.
6. Customer Groups are hidden operationally but remain a Lunar invariant.
7. Legacy and normalized event/shipment sources can duplicate data.
8. Cross-subdomain cookies require correct CORS, CSRF, domain, Secure, and SameSite settings.

Controls include incremental rollout, dedicated API resources, server-side policies, conditional serialization, idempotency, audit events, feature flags, legacy deep links, automated tests, and production observation periods.

## 17. Approved roadmap

```text
0. Security and platform groundwork
1. Customer Reviews moderation pilot
2. Orders read-only
3. Order internal notes
4. Return Requests
5. Customers read-only
6. Shipping
7. Discounts
8. Higher-risk Order mutations
9. Filament decommission decision gate
```

The approved direction is a React presentation layer backed by Laravel/Lunar domain APIs, secure shared authentication, permission parity, and incremental operational cutover. It explicitly rejects a big-bang rewrite, iframe embedding, forwarding Livewire pages, or moving commerce business logic into the frontend.
