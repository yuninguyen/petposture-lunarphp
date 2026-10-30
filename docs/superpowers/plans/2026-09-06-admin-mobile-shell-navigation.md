# Admin Mobile Shell and Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every authorized React-admin module reachable on mobile and replace brittle index-based navigation filtering with explicit semantic navigation metadata.

**Architecture:** Extract navigation into a single typed source consumed by desktop and mobile. Add an accessible off-canvas drawer to `AppShell`, with explicit open/close lifecycle and current-route state. Preserve existing role behavior through named capability predicates until server-provided abilities arrive.

**Tech Stack:** React, TypeScript, React Router, Vite, Tailwind CSS, i18next, Vitest/Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-06-order-email-content-admin-followups-design.md`

## Global Constraints

- This fixes post-login navigation, not the separate login-page positioning plan.
- Mobile and desktop consume the same navigation source.
- No navigation filtering by array index.
- Hidden navigation is not authorization; backend protection remains authoritative.
- Drawer requires hamburger, overlay click, Escape, route-change close, focus management, and body-scroll lock.
- Every new/changed string exists in EN and VI.
- Existing specialized-role access must not broaden.
- Responsive list/detail redesign is a separate pass.
- Run GitNexus impact before symbol edits and detect-changes before commits.

---

### Task 1: Extract Typed Navigation Metadata

**Files:**
- Create: `admin/src/navigation/adminNavigation.tsx`
- Create: `admin/src/navigation/adminNavigation.test.tsx`
- Modify: `admin/src/layouts/AppShell.tsx`
- Modify: `admin/src/lib/access.ts` and tests if required.

**Interfaces:**

```ts
type AdminNavGroupKey = 'commerce' | 'catalog' | 'content' | 'affiliate' | 'finance' | 'system';
type AdminNavItem = {
  key: string;
  labelKey: string;
  path: string;
  icon: React.ComponentType;
  canAccess: (session: AdminSession) => boolean;
};
type AdminNavGroup = {
  key: AdminNavGroupKey;
  labelKey: string;
  items: AdminNavItem[];
};
export function getVisibleNavigation(session: AdminSession): AdminNavGroup[];
```

- [ ] Characterize current core-admin, Product Manager, Order Manager/Sales, and Support visibility.
- [ ] Add a test proving inserting/reordering groups does not change permissions.
- [ ] Extract current definitions with stable keys and named predicates.
- [ ] Remove `filter((_, index) => ...)` behavior.
- [ ] Preserve current effective access exactly; do not add future routes yet.
- [ ] Run tests/build and commit `refactor(admin): centralize semantic navigation`.

---

### Task 2: Build the Accessible Mobile Drawer

**Files:**
- Create: `admin/src/components/navigation/MobileAdminNav.tsx`
- Create: `admin/src/components/navigation/MobileAdminNav.test.tsx`
- Modify: `admin/src/layouts/AppShell.tsx`
- Modify: `admin/src/locales/en.json`
- Modify: `admin/src/locales/vi.json`

**Interfaces:**

```ts
type MobileAdminNavProps = {
  groups: AdminNavGroup[];
  open: boolean;
  onClose: () => void;
};
```

- [ ] Add failing tests for hamburger accessible name, `aria-expanded`, drawer labeling, authorized links, and active route.
- [ ] Add open/close tests for hamburger, close button, overlay, and Escape.
- [ ] Add focus tests: opening focuses close button/first link; closing returns focus to hamburger; Tab remains inside drawer while open.
- [ ] Add body scroll-lock and cleanup-on-unmount tests.
- [ ] Render hamburger only below `md`; keep desktop sidebar visually unchanged.
- [ ] Use fixed overlay/off-canvas panel, adequate z-index, touch targets, and reduced-motion-safe transition.
- [ ] Reuse the one navigation data source; do not duplicate role logic.
- [ ] Add EN/VI labels: Open navigation, Close navigation, Admin navigation.
- [ ] Run tests/build and commit `feat(admin): add accessible mobile navigation`.

---

### Task 3: Close Drawer on Navigation Lifecycle

**Files:**
- Modify: `admin/src/layouts/AppShell.tsx`
- Test: `admin/src/components/navigation/MobileAdminNav.test.tsx` or `admin/src/layouts/AppShell.test.tsx`

- [ ] Add failing test that route location change closes drawer.
- [ ] Add test that logout/session loss closes it and releases body lock.
- [ ] Use `useLocation()` effect to close on pathname/search changes.
- [ ] Ensure Back/Forward follows the same behavior.
- [ ] Ensure desktop resize does not leave body locked or stale focus handling active.
- [ ] Run tests/build and commit `fix(admin): reset mobile drawer on navigation`.

---

### Task 4: Correct Home-Route Selection Foundation

**Files:**
- Modify: `admin/src/App.tsx`
- Modify: `admin/src/App.test.ts`
- Modify: `admin/src/lib/auth.ts` only if home logic lives there.

- [ ] Characterize current home destinations for each existing role.
- [ ] Replace hardcoded/index-coupled selection with ordered first-accessible home policy.
- [ ] Until Dashboard exists, preserve current effective destinations but make them data-driven/testable.
- [ ] Add future-safe test that an authorized `/dashboard` becomes core-admin home without changing specialized homes.
- [ ] Do not expose unauthorized routes.
- [ ] Run routing tests/build and commit `refactor(admin): make home routes capability-aware`.

---

### Task 5: Responsive Browser Verification

- [ ] Test core admin and every specialized role at 360×800, 390×844, 768×900, and desktop ≥1024.
- [ ] Confirm every currently authorized destination is reachable on mobile.
- [ ] Confirm unauthorized groups/items are absent and backend direct-route denial remains.
- [ ] Verify overlay/Escape/route close, focus return, keyboard navigation, screen-reader labels, scroll lock, Back/Forward, and resize/orientation.
- [ ] Confirm desktop sidebar is unchanged and login page is untouched.
- [ ] Run full admin tests/build, accessibility audit if available, GitNexus detect-changes, and diff review.

## Definition of Done

1. Mobile users reach every authorized module.
2. Desktop/mobile use one navigation source.
3. No array-index authorization remains.
4. Drawer lifecycle/accessibility behavior is tested.
5. Existing role access is preserved.
6. Dashboard can become core-admin home without another nav rewrite.
