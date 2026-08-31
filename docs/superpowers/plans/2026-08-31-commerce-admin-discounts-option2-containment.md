# Discounts Option 2 Safe-Containment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent the Discount admin from creating non-operational checkout discounts while retaining safe read-only/delete cleanup for legacy unsupported rows.

**Architecture:** The backend makes the safe boundary authoritative: only coupon-required Lunar AmountOff requests can mutate, and resources explicitly label all other persisted types unsupported without throwing. The frontend removes unsupported creation controls, presents legacy rows read-only, validates containment rules client-side, and makes pagination/error behavior recoverable. Checkout remains untouched.

**Tech Stack:** Laravel 11/PHP, Lunar, Sanctum/Spatie Permission, React/TypeScript, React Query, React Router, Vitest, i18next.

**Spec:** `docs/superpowers/specs/2026-08-31-commerce-admin-discounts-option2-containment-design.md`

## Global Constraints

- Retain only coupon-required `Lunar\DiscountTypes\AmountOff` mutation support.
- Do not modify `ApplyCouponService`, `CheckoutService`, Lunar vendor, migrations, storefront, permission matrix, or `EnforceAdminApiPermission`.
- Legacy non-AmountOff rows are list/show read-only and deleteable; update must not mutate them.
- Existing core-only authorization remains `super_admin|admin|staff`.
- No commit, merge, or push; leave all changes for Claude review.
- Use exact task-file reviews because the worktree retains uncommitted Round 3/4a changes.

---

### Task 1: Backend containment policy and legacy resource safety

**Files:**
- Modify: `backend/app/Http/Controllers/Api/Admin/DiscountController.php`
- Modify: `backend/tests/Feature/Api/Admin/DiscountControllerTest.php`

**Interfaces:**
- Consumes: current Discount API fields and nested decimal `data` contract.
- Produces: resource field `supported: bool`, safe `type_label`, and a mutation contract limited to coupon-required AmountOff.

- [ ] **Step 1: Write failing feature coverage for rejection and containment**

Add tests that assert:

```php
$this->actingAs($admin)->postJson('/api/admin/discounts', amountOffPayload([
    'coupon' => '',
]))->assertUnprocessable()->assertJsonValidationErrors('coupon');

$this->actingAs($admin)->postJson('/api/admin/discounts', amountOffPayload([
    'type' => FixedAmountOffPerUnit::class,
]))->assertUnprocessable()->assertJsonValidationErrors('type');

$this->actingAs($admin)->postJson('/api/admin/discounts', amountOffPayload([
    'data' => ['fixed_value' => false, 'percentage' => 100.01],
]))->assertUnprocessable()->assertJsonValidationErrors('data.percentage');

$this->actingAs($admin)->postJson('/api/admin/discounts', amountOffPayload([
    'max_uses' => 0,
]))->assertUnprocessable()->assertJsonValidationErrors('max_uses');
```

Create a raw legacy `FixedAmountOffPerUnit` row and assert index/show return `supported: false`, `type_label: 'Unsupported'`, no 500, DELETE returns 204, and PUT does not alter its name.

- [ ] **Step 2: Run the focused test to observe RED**

Run from `backend`:

```powershell
$env:APP_ENV='testing'; $env:MAIL_MAILER='array'; $env:DB_CONNECTION='sqlite'; $env:DB_DATABASE=':memory:'; $env:APP_KEY='base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='; php artisan test tests/Feature/Api/Admin/DiscountControllerTest.php
```

Expected: failures because coupon/type/upper-bound/lifecycle rules and `supported` do not yet exist.

- [ ] **Step 3: Implement minimal authoritative controller changes**

Use the local model and a single supported type map:

```php
use App\Models\Discount;
use Lunar\DiscountTypes\AmountOff;

private const TYPES = [AmountOff::class => 'Amount off'];

private function isSupported(Discount $discount): bool
{
    return $discount->type === AmountOff::class;
}
```

Make `coupon` `required`, constrain `type` to `array_keys(self::TYPES)`, constrain percentage `between:0,100`, and use `min:1` for supplied use limits. Reject update before validation/mutation when `! $this->isSupported($discount)`.

Replace both `match` expressions with an AmountOff branch plus a fallback returning only normalized `min_prices`; resource emits:

```php
'supported' => $this->isSupported($discount),
'type_label' => self::TYPES[$discount->type] ?? 'Unsupported',
```

Keep direct deletion of all rows. Keep AmountOff decimal/minor conversion unchanged.

- [ ] **Step 4: Run focused GREEN verification**

Run the Step 2 command. Expected: all Discount controller tests pass, including valid percentage and fixed-cart create/update money conversion.

- [ ] **Step 5: Run affected backend regressions**

```powershell
$env:APP_ENV='testing'; $env:MAIL_MAILER='array'; $env:DB_CONNECTION='sqlite'; $env:DB_DATABASE=':memory:'; $env:APP_KEY='base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='; php artisan test tests/Feature/Api/Admin/DiscountControllerTest.php tests/Feature/AdminPermissionMatrixTest.php tests/Feature/CheckoutApiTest.php
php artisan route:list --path=api/admin/discounts --json
git diff --check
```

Expected: checkout suite remains green without production checkout changes; all six routes retain the nested core-only role middleware.

### Task 2: Typed frontend contract and safe form boundary

**Files:**
- Modify: `admin/src/features/discounts/api.ts`
- Modify: `admin/src/features/discounts/api.test.ts`
- Modify: `admin/src/features/discounts/DiscountFormPage.tsx`
- Modify: `admin/src/features/discounts/DiscountFormPage.test.tsx`
- Modify: `admin/src/locales/en.json`
- Modify: `admin/src/locales/vi.json`

**Interfaces:**
- Consumes: Task 1 `Discount.supported` and only AmountOff mutation API.
- Produces: a no-throw datetime conversion path and AmountOff-only form payload/UI.

- [ ] **Step 1: Write failing frontend tests**

Add tests that prove:

```ts
expect(screen.queryByLabelText('discounts.type')).not.toBeInTheDocument();
expect(screen.queryByLabelText('discounts.min_qty')).not.toBeInTheDocument();
expect(screen.queryByLabelText('discounts.fixed_value_usd')).toBeInTheDocument();
```

For create submission, blank coupon, percentage `100.01`, and `max_uses` `0` must render their `discounts.*` field messages and not call the mutation. Simulate invalid datetime input and assert no throw/no mutation. Mock a 422 error containing `{ errors: { coupon: ['The coupon has already been taken.'] } }` and assert that field message is shown in the alert.

For a `supported: false` detail response, assert no editable form controls/mutation buttons are shown and read-only legacy content is visible.

- [ ] **Step 2: Run focused frontend tests to observe RED**

From `admin`:

```powershell
npm test -- src/features/discounts/api.test.ts src/features/discounts/DiscountFormPage.test.tsx
```

Expected: failing assertions because old type union/form fields, date conversion, and server-validation mapping still exist.

- [ ] **Step 3: Minimize types, payload builder, and form UI**

In `api.ts`, make `DiscountType` only `typeof AMOUNT_OFF_TYPE`; remove per-unit/BuyX payload branches/form-only fields; add `supported: boolean` to `Discount`. Ensure `toIsoUtc` first checks a valid `Date` and returns a safe failure value consumed by form validation rather than invoking `toISOString()` on invalid input.

In the form, use only the AmountOff fixed toggle. Coupon input has `required`; percentage input has `max="100"`; limits have `min="1"`. Validate parseability before calling a payload builder. Normalize 422 error payloads into alert messages, preserving generic error toast only when no field messages exist. A `supported:false` resource returns an explicit read-only legacy state.

Add exact English/Vietnamese `discounts.*` messages for required coupon, maximum percentage, positive-use limit, invalid datetime, unsupported legacy record, and field validation summary.

- [ ] **Step 4: Run focused GREEN verification**

Run the Step 2 command. Expected: all API/form tests pass with supported AmountOff payloads, error mapping, no invalid-date exception, and legacy read-only behavior.

- [ ] **Step 5: Run production build**

```powershell
npm run build
git diff --check
```

Expected: TypeScript build and whitespace check pass.

### Task 3: Legacy list actions and delete pagination recovery

**Files:**
- Modify: `admin/src/features/discounts/DiscountsListPage.tsx`
- Modify: `admin/src/features/discounts/DiscountsListPage.test.tsx`
- Modify: `admin/src/features/discounts/DiscountRowActions.tsx`
- Modify: `admin/src/locales/en.json`
- Modify: `admin/src/locales/vi.json`

**Interfaces:**
- Consumes: Task 1 resource `supported` flag and Task 2 legacy route behavior.
- Produces: read-only action affordance for unsupported rows and page recovery after delete.

- [ ] **Step 1: Write failing list/action tests**

Mock an unsupported row:

```ts
{ ...discount, supported: false, type_label: 'Unsupported' }
```

Assert the action opens `/discounts/:id` using a localized view/read-only label rather than edit, while Delete remains available. For page 2 with exactly one visible item and `meta.last_page === 2`, invoke successful delete and assert the next query/render uses page 1.

- [ ] **Step 2: Run focused list test to observe RED**

```powershell
npm test -- src/features/discounts/DiscountsListPage.test.tsx
```

Expected: unsupported rows currently receive edit action and deletion leaves page state unchanged.

- [ ] **Step 3: Implement action and page-state containment**

Render `discounts.view` for `!discount.supported`; keep `discounts.edit` only for supported records. On delete success, before clearing modal state:

```ts
if (discounts.length === 1 && page > 1) setPage((current) => current - 1);
```

Do not modify normal search/pagination behavior. Add locale keys for the view/read-only affordance.

- [ ] **Step 4: Run focused GREEN verification**

Run the Step 2 command. Expected: existing list behavior and new unsupported/delete-page cases pass.

- [ ] **Step 5: Run full frontend regression and inspect scope**

```powershell
npm test
npm run build
git diff --check
git status --short
```

Expected: full admin suite/build pass; only planned Option 2 files plus prior uncommitted Round 3/4a work are present.

### Task 4: Whole-remediation verification and Claude handoff

**Files:**
- Create: `.superpowers/sdd/2026-08-31-commerce-admin-discounts-option2-containment/final-verification.md`
- Modify: no production code unless a reviewer validates a critical/important defect.

**Interfaces:**
- Consumes: Task 1–3 test/report evidence.
- Produces: review-ready verification package; no Git commit.

- [ ] **Step 1: Independent whole-diff review**

Review only Option 2 task files against the containment spec. Confirm no checkout/coupon service, vendor, migration, storefront, permission matrix, or middleware file changed. Confirm all supported mutation requests require coupon and AmountOff.

- [ ] **Step 2: Run fresh final backend verification**

```powershell
$env:APP_ENV='testing'; $env:MAIL_MAILER='array'; $env:DB_CONNECTION='sqlite'; $env:DB_DATABASE=':memory:'; $env:APP_KEY='base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='; php artisan test tests/Feature/Api/Admin/DiscountControllerTest.php tests/Feature/AdminPermissionMatrixTest.php tests/Feature/CheckoutApiTest.php
php artisan route:list --path=api/admin/discounts --json
git diff --check
```

Expected: all named tests pass; all six routes retain nested core-only middleware.

- [ ] **Step 3: Run fresh final admin verification**

```powershell
npm test
npm run build
git diff --check
```

Expected: complete admin test suite and production build pass.

- [ ] **Step 4: Write final handoff evidence**

Write exact commands/results, independent review outcome, supported/unsupported policy, known non-failing environment warnings, and explicit “uncommitted; Claude review required; do not merge” statement to the Task 4 report.

- [ ] **Step 5: Do not commit**

Do not stage, commit, merge, or push any file. Present exact changed paths and verification evidence to Claude.

## Plan self-review

- Spec coverage: Task 1 implements server policy/local model/fallback/lifecycle; Task 2 implements safe form/payload/date/422 behavior; Task 3 implements legacy action/pagination recovery; Task 4 verifies scope/regressions/handoff.
- Placeholder scan: no TBD/TODO/future-work placeholders remain.
- Interface consistency: `supported` is produced in Task 1, typed in Task 2, and consumed by Task 2/3. `AmountOff` is the only mutation type across controller, API builder, and form.
