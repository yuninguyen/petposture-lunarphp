# Account Address Edit and Order Summary Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let customers edit a saved address from `/account` (backend endpoint already exists and is unused), and tighten the visual presentation of the order shipping label and totals summary.

**Architecture:** Frontend-only changes to `frontend/app/account/page.tsx`. Reuse the existing "New Address" form in an edit mode that calls the existing `PUT /api/me/addresses/{id}` endpoint instead of adding new backend surface. Presentation-only tweaks to the order summary block; no calculation or data-shape changes.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Node test runner (existing source-contract convention in `frontend/app/account/page.test.mjs`).

**Spec:** None — this is a bounded fix approved directly in chat on 2026-09-07 (not an architectural change; see Global Constraints for the full approved scope). Sitewide color palette changes (`text-rust`, `Log Out` red, status badges) and the Header mobile-overflow bug were explicitly raised in the same conversation and explicitly deferred to separate, dedicated work — do not fold either into this plan.

## Global Constraints

- Backend already exposes `PUT /api/me/addresses/{id}` and `PATCH /api/me/addresses/{id}` (`backend/routes/api.php:318-319`, `UserAddressController::update`) — no backend changes in this plan.
- Do not touch `frontend/components/Header.tsx` (mobile overflow is separate, deferred work).
- Do not change any `text-rust`, `text-red-500`, or other color classes — color palette is separate, deferred work.
- Do not change order calculation logic, `itemCount()`, tax/shipping/total values, or the customer-safe API contract.
- Preserve the existing `node:test` source-contract convention in `frontend/app/account/page.test.mjs` (string-slice `between()` helper plus AST helpers already defined there) — do not switch to a rendered-DOM test approach.
- All new/changed customer-facing copy stays in English (existing account page has no i18n layer).
- Preserve unrelated working-tree changes.

---

### Task 1: Add an Edit Action to Saved Addresses

**Files:**
- Modify: `frontend/app/account/page.tsx`
- Modify: `frontend/app/account/page.test.mjs`

**Interfaces:**
- New state: `editingAddressId: number | null`.
- New handler: `handleEditAddress(addr: Address): void` — pre-fills `addressForm` and opens the form in edit mode.
- Renamed handler: `handleAddAddress` → `handleSubmitAddress(e: React.FormEvent): Promise<void>` — branches to `PUT /api/me/addresses/{id}` when `editingAddressId` is set, otherwise keeps the existing `POST /api/me/addresses` behavior.

- [ ] **Step 1: Add failing source-contract tests**

Add to `frontend/app/account/page.test.mjs` (after the existing `separateBillingPayload` block, before `jsxButtons`):

```js
const addressesTab = between(
    accountSource,
    "tab === 'addresses' ? (",
    '<div className="grid sm:grid-cols-2 gap-6 text-[14px] text-primary">',
    'addresses tab',
);

test('address list renders an edit action that pre-fills the form', () => {
    assert.match(addressesTab, /onClick=\{\(\) => handleEditAddress\(addr\)\}/);
    assert.match(addressesTab, /<Pencil size=\{16\}/);
});

test('address form submission branches PUT vs POST on editingAddressId', () => {
    assert.match(accountSource, /const handleSubmitAddress = async/);
    assert.match(
        accountSource,
        /editingAddressId \? `\/api\/me\/addresses\/\$\{editingAddressId\}` : '\/api\/me\/addresses'/,
    );
    assert.match(accountSource, /method: editingAddressId \? 'PUT' : 'POST'/);
});

test('address form heading and submit label reflect edit mode', () => {
    assert.match(addressesTab, /\{editingAddressId \? 'Edit Address' : 'New Address'\}/);
    assert.match(addressesTab, /editingAddressId \? 'Update Address' : 'Save Address'/);
});

test('closing the address form resets editingAddressId', () => {
    assert.match(addressesTab, /setEditingAddressId\(null\)/);
});
```

- [ ] **Step 2: Run RED**

```powershell
cd frontend
node --test app/account/page.test.mjs
```

Expected: the four new tests fail (symbols/markers do not exist yet); all prior tests still pass.

- [ ] **Step 3: Add the `Pencil` icon import**

In `frontend/app/account/page.tsx`, change:

```tsx
import { Package, MapPin, User as UserIcon, LogOut, Trash2, Plus, X, ChevronDown } from 'lucide-react';
```

to:

```tsx
import { Package, MapPin, User as UserIcon, LogOut, Trash2, Pencil, Plus, X, ChevronDown } from 'lucide-react';
```

- [ ] **Step 4: Add `editingAddressId` state**

Directly below the existing `const [savingAddress, setSavingAddress] = useState(false);` line, add:

```tsx
const [editingAddressId, setEditingAddressId] = useState<number | null>(null);
```

- [ ] **Step 5: Replace `handleAddAddress` with `handleSubmitAddress`**

Replace the entire existing `handleAddAddress` function with:

```tsx
const handleEditAddress = (addr: Address) => {
    setAddressForm({
        first_name: addr.first_name,
        last_name: addr.last_name,
        line_one: addr.line_one,
        line_two: addr.line_two ?? '',
        city: addr.city,
        state: addr.state,
        postcode: addr.postcode,
        phone: addr.phone ?? '',
    });
    setEditingAddressId(addr.id);
    setShowAddressForm(true);
};

const handleSubmitAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingAddress(true);

    try {
        const res = await fetchApi(
            editingAddressId ? `/api/me/addresses/${editingAddressId}` : '/api/me/addresses',
            {
                method: editingAddressId ? 'PUT' : 'POST',
                body: addressForm,
            },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to save address.');
        setAddresses((prev) =>
            editingAddressId
                ? prev.map((a) => (a.id === editingAddressId ? data.data : a))
                : [...prev, data.data],
        );
        setAddressForm(emptyAddressForm);
        setShowAddressForm(false);
        setEditingAddressId(null);
    } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save address.');
    } finally {
        setSavingAddress(false);
    }
};
```

- [ ] **Step 6: Wire the address list Edit button**

Replace this block:

```tsx
                                            <button
                                                onClick={() => handleDeleteAddress(addr.id)}
                                                className="text-zinc-400 hover:text-red-500 transition-colors"
                                                title="Delete address"
                                            >
                                                <Trash2 size={16} />
                                            </button>
```

with:

```tsx
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => handleEditAddress(addr)}
                                                    className="text-zinc-400 hover:text-primary transition-colors"
                                                    title="Edit address"
                                                >
                                                    <Pencil size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteAddress(addr.id)}
                                                    className="text-zinc-400 hover:text-red-500 transition-colors"
                                                    title="Delete address"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
```

- [ ] **Step 7: Update the form's submit handler, heading, close button, and submit label**

Change `<form onSubmit={handleAddAddress} ...>` to `<form onSubmit={handleSubmitAddress} ...>`.

Change:

```tsx
<p className="font-bold text-sm text-primary uppercase tracking-wide">New Address</p>
```

to:

```tsx
<p className="font-bold text-sm text-primary uppercase tracking-wide">{editingAddressId ? 'Edit Address' : 'New Address'}</p>
```

Change the close (`X`) button's `onClick`:

```tsx
<button type="button" onClick={() => setShowAddressForm(false)} className="text-zinc-400 hover:text-primary">
```

to:

```tsx
<button
    type="button"
    onClick={() => {
        setShowAddressForm(false);
        setEditingAddressId(null);
        setAddressForm(emptyAddressForm);
    }}
    className="text-zinc-400 hover:text-primary"
>
```

Change the submit button label:

```tsx
{savingAddress ? 'Saving...' : 'Save Address'}
```

to:

```tsx
{savingAddress ? 'Saving...' : editingAddressId ? 'Update Address' : 'Save Address'}
```

Change the "Add New Address" toggle button's `onClick`:

```tsx
onClick={() => setShowAddressForm(true)}
```

to:

```tsx
onClick={() => {
    setAddressForm(emptyAddressForm);
    setEditingAddressId(null);
    setShowAddressForm(true);
}}
```

- [ ] **Step 8: Run GREEN**

```powershell
cd frontend
node --test app/account/page.test.mjs
npm run lint -- app/account/page.tsx
npm run build
```

Expected: all tests pass, lint clean, build succeeds.

- [ ] **Step 9: Commit**

```powershell
git add frontend/app/account/page.tsx frontend/app/account/page.test.mjs
git diff --cached
git commit -m "feat(account): allow editing a saved address" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: Polish Shipping Label Format and Order Summary Alignment

**Files:**
- Modify: `frontend/app/account/page.tsx`
- Modify: `frontend/app/account/page.test.mjs`

- [ ] **Step 1: Add failing source-contract tests**

Add to `frontend/app/account/page.test.mjs`:

```js
test('shipping summary row uses "Shipping (method)" format', () => {
    assert.match(expandedTotals, /<span>Shipping \(\{order\.shipping_label\}\)<\/span>/);
});

test('summary rows are wrapped in a narrow right-aligned column', () => {
    assert.match(expandedTotals, /<div className="ml-auto max-w-\[260px\] space-y-1">/);
});
```

- [ ] **Step 2: Run RED**

```powershell
cd frontend
node --test app/account/page.test.mjs
```

Expected: the two new tests fail; all prior tests (including Task 1's) still pass.

- [ ] **Step 3: Change the shipping label format**

Change:

```tsx
<div className="flex justify-between text-zinc-500"><span>Shipping - {order.shipping_label}</span><span>{order.shipping_total === 0 ? 'Free' : `$${order.shipping_total.toFixed(2)}`}</span></div>
```

to:

```tsx
<div className="flex justify-between text-zinc-500"><span>Shipping ({order.shipping_label})</span><span>{order.shipping_total === 0 ? 'Free' : `$${order.shipping_total.toFixed(2)}`}</span></div>
```

- [ ] **Step 4: Narrow and right-align the summary block**

Replace this block (the outer `space-y-1` wrapper and all rows inside it):

```tsx
                                                            <div className="pt-3 border-t border-zinc-100 space-y-1 text-sm">
                                                                <div className="flex justify-between text-zinc-500"><span>Subtotal &middot; {itemCount(order)} item{itemCount(order) === 1 ? '' : 's'}</span><span>${order.sub_total.toFixed(2)}</span></div>
                                                                {order.discount_total > 0 && (
                                                                    <div className="flex justify-between text-zinc-500"><span>Discount</span><span>-${order.discount_total.toFixed(2)}</span></div>
                                                                )}
                                                                <div className="flex justify-between text-zinc-500"><span>Shipping ({order.shipping_label})</span><span>{order.shipping_total === 0 ? 'Free' : `$${order.shipping_total.toFixed(2)}`}</span></div>
                                                                <div className="flex justify-between text-zinc-500"><span>Estimated Taxes</span><span>${order.tax_total.toFixed(2)}</span></div>
                                                                <div className="flex justify-between font-bold text-primary pt-1"><span>Total</span><span><span className="mr-1 text-xs font-medium text-zinc-400">{order.currency}</span>{order.total.formatted}</span></div>
                                                            </div>
```

with:

```tsx
                                                            <div className="pt-3 border-t border-zinc-100 text-sm">
                                                                <div className="ml-auto max-w-[260px] space-y-1">
                                                                    <div className="flex justify-between text-zinc-500"><span>Subtotal &middot; {itemCount(order)} item{itemCount(order) === 1 ? '' : 's'}</span><span>${order.sub_total.toFixed(2)}</span></div>
                                                                    {order.discount_total > 0 && (
                                                                        <div className="flex justify-between text-zinc-500"><span>Discount</span><span>-${order.discount_total.toFixed(2)}</span></div>
                                                                    )}
                                                                    <div className="flex justify-between text-zinc-500"><span>Shipping ({order.shipping_label})</span><span>{order.shipping_total === 0 ? 'Free' : `$${order.shipping_total.toFixed(2)}`}</span></div>
                                                                    <div className="flex justify-between text-zinc-500"><span>Estimated Taxes</span><span>${order.tax_total.toFixed(2)}</span></div>
                                                                    <div className="flex justify-between font-bold text-primary pt-1"><span>Total</span><span><span className="mr-1 text-xs font-medium text-zinc-400">{order.currency}</span>{order.total.formatted}</span></div>
                                                                </div>
                                                            </div>
```

Note: the outer `<div className="pt-3 border-t border-zinc-100 text-sm">` keeps the full-width top divider consistent with the line-items block above it; only the label/amount rows themselves are narrowed and pushed right via the inner `ml-auto max-w-[260px]` wrapper.

- [ ] **Step 5: Run GREEN**

```powershell
cd frontend
node --test app/account/page.test.mjs
npm run lint -- app/account/page.tsx
npm run build
```

Expected: all tests pass, lint clean, build succeeds.

- [ ] **Step 6: Commit**

```powershell
git add frontend/app/account/page.tsx frontend/app/account/page.test.mjs
git diff --cached
git commit -m "fix(account): format shipping label and align order summary" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: Cross-Browser Verification

- [ ] Run the full frontend suite and build once more:

```powershell
cd frontend
npm test
npm run build
```

- [ ] In a real browser (not curl), on `/account`:
  - Add a new address; confirm it appears in the list.
  - Click Edit on an existing address; confirm the form opens pre-filled, heading reads "Edit Address", and the submit button reads "Update Address".
  - Submit an edit; confirm the address list updates in place (no duplicate row) and the address's `is_default` badge behavior is unchanged.
  - Click the form's close (`X`) button while editing; confirm it clears back to a blank "New Address" state on next open, not stale edit data.
  - Expand an order with a paid shipping method and one with free shipping; confirm "Shipping (Standard)"-style format and that Subtotal/Shipping/Estimated Taxes/Total now sit close to their amounts on the right instead of spanning the full card width.
  - Verify at both desktop (≥1024px) and mobile (390px) widths — confirm the narrower summary column does not itself introduce horizontal overflow.
- [ ] Confirm no `text-rust`/`text-red-500`/color class was touched (`git diff` should show none) and `frontend/components/Header.tsx` is untouched.
- [ ] Run GitNexus detect-changes and inspect the final diff.

## Definition of Done

1. Customers can edit an existing address in place using the already-existing backend `PUT` endpoint; no backend changes were needed or made.
2. Editing an address does not create a duplicate row and does not silently drop `label`/`country_code`/`is_default` on the backend record.
3. Shipping row reads `Shipping (Method)`.
4. Subtotal/Shipping/Estimated Taxes/Total sit in a narrow, right-aligned column instead of being spread across the full card width, without breaking the section divider styling.
5. No color class, `Header.tsx`, order calculation logic, or the customer-safe API contract was touched.
