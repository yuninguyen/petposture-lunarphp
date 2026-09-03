# Project Plan: Accessibility & Performance Optimization

## Goal
Improve PageSpeed Insights scores for Mobile (currently ~89) and Desktop (100) by addressing Core Web Vitals (LCP, JS payload) and fixing Accessibility (a11y) shortcomings (missing ARIA labels).

> Revised 2026-08-30: verified against actual code (`frontend/app/cart/page.tsx`, `Header.tsx`, `Footer.tsx`, `Hero.tsx`, `HomePage.tsx`, `GoogleAnalytics.tsx`). Several tasks from the original (Gemini) draft were already implemented or misdirected — removed/narrowed below.

## Phase 1: Accessibility (A11y) Quick Wins

### Tasks
- [ ] **Cart Page (`app/cart/page.tsx`)** — confirmed missing:
  - Add `aria-label="Remove item"` to the `X` (delete) button (both mobile and desktop instances, lines ~189 and desktop row).
  - Add `aria-label="Decrease quantity"` to the `-` button (mobile line ~215, desktop line ~244).
  - Add `aria-label="Increase quantity"` to the `+` button (mobile line ~222, desktop line ~251).
- [ ] **Header (`components/Header.tsx`)** — targeted gaps only (Menu, Search, Wishlist, Cart icons already have `aria-label`; do not touch those):
  - Mobile drawer close button (`X`, ~line 286) has no `aria-label` — add `aria-label="Close menu"`.
  - "My Account" link (~line 135) uses `title` only — add `aria-label="My account"`.
  - "Log Out" button (~line 138) uses `title` only — add `aria-label="Log out"`.
  - "Login / Register" link (~line 143) uses `title` only — add `aria-label="Login or register"`.
- [x] ~~Footer audit~~ — **not needed**. `components/Footer.tsx` already has `aria-label` on every social icon, the email link, and the "Back to top" button.
- [ ] **Color contrast** — spot-check muted text (`text-zinc-400` on white, e.g. cart empty-state copy) with Lighthouse; only fix if it actually flags below 4.5:1. Not confirmed as a real issue yet.

## Phase 2: Performance (LCP & Image Optimization)

### Tasks
- [x] ~~Hero image `priority`~~ — **already done**. `components/Hero.tsx:35` already sets `priority` on the hero `<Image>`. No action needed.
- [ ] **Cart list image `priority`** — low value, do only if time permits. Cart page product thumbnails (56-80px) are not the LCP element PageSpeed is scoring (that's almost certainly the homepage hero or a product page). Adding `priority={index === 0}` in `app/cart/page.tsx` is harmless but won't move the ~89 mobile score.
- [ ] **Image `sizes` attributes** — mostly already present (Hero, cart thumbnails, HomePage image blocks all have `sizes` set). Do a quick grep for `<Image` usages missing `sizes`/`fill` pairing rather than blanket-applying to everything; only fix what's actually missing.

## Phase 3: Javascript Payload Reduction (INP & TBT)

### Tasks
- [ ] **Lazy Loading (Below-the-fold)** — confirmed gap, no `next/dynamic` usage anywhere in `frontend/`. Wrap non-critical below-the-fold components (Footer, modals, reviews section) with `next/dynamic`.
- [ ] **3rd-Party Scripts** — `components/GoogleAnalytics.tsx:37` currently uses `strategy="afterInteractive"`, not `lazyOnload`. Consider switching to `lazyOnload`; expect marginal gain since `afterInteractive` already doesn't block initial render — deprioritize if other Phase 3 work is more impactful.

## Verification Checklist
- [ ] Run Lighthouse / PageSpeed Insights again after deployment.
- [ ] Verify Mobile Performance > 95.
- [ ] Verify Mobile Accessibility = 100.
- [ ] Test screen reader (or manually inspect HTML) to ensure all icon-only buttons have `aria-label`.
