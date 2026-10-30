# Comparison Post and Rich Table Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete bilingual comparison fields, use saved image alt text, and render sanitized TipTap tables as attractive responsive article tables.

**Architecture:** Keep comparison metadata storage unchanged. Add missing locale values and alt fallback. Extend the sanitizer only for required table structure/width metadata, then decorate sanitized tables with application-owned wrappers and scoped CSS.

**Tech Stack:** React, Next.js 16, TypeScript, Tailwind CSS 4, DOMPurify, Vitest/Node test runner, Laravel API metadata.

**Spec:** `docs/superpowers/specs/2026-09-06-order-email-content-admin-followups-design.md`

## Global Constraints

- No migration/backfill; all admin strings must exist in EN and VI.
- Locale owns words; JSX owns one pair of parentheses.
- `image_alt` remains optional with product-name fallback.
- Sanitization precedes trusted decoration.
- Extend only TipTap table allowlists (`colgroup`, `col`, safe sizing fields); never arbitrary class/style/data/event attributes.
- Preserve XSS and URI protections.
- Read Next.js 16 docs before frontend edits.
- Run GitNexus impact before symbol edits and detect-changes before commits.
- Locale files are already modified; stage intended hunks only.

---

### Task 1: Complete Comparison Locales

**Files:**
- Create: `admin/src/locales/postComparisonLocales.test.ts`
- Modify: `admin/src/locales/en.json`
- Modify: `admin/src/locales/vi.json`

- [x] Add failing assertions for `Image alt text`, `Văn bản thay thế hình ảnh`, `optional`, and `không bắt buộc`, plus exactly one composed parenthesis pair.
- [x] Run `npm --prefix admin test -- src/locales/postComparisonLocales.test.ts`.
- [x] Add missing keys and remove parentheses from English suffix; do not change component punctuation.
- [x] Run locale/schema tests and admin build.
- [x] Stage locale hunks interactively and commit `fix(admin): complete comparison field translations`.

---

### Task 2: Use Saved Comparison Image Alt Text

**Files:**
- Create: `frontend/components/blog/ComparisonTable.test.mjs`
- Modify: `frontend/components/blog/ComparisonTable.tsx`
- Reference only: `backend/app/Http/Controllers/Api/PostController.php`
- Reference only: `backend/app/Http/Resources/Api/PostResource.php`

- [x] Verify backend already validates/persists/returns `image_alt`; no backend edit.
- [x] Add failing contract for `image_alt?: string | null` and `alt={item.image_alt?.trim() || item.product_name}`.
- [x] Add type/property and fallback; leave retailer-logo alt unchanged.
- [x] Run Node test, frontend type-check/lint, and backend comparison characterization.
- [x] Commit `fix(frontend): use comparison image alt text`.

---

### Task 3: Preserve Safe TipTap Table Metadata

**Files:**
- Modify: `frontend/lib/sanitize-rich-html.ts`
- Modify: `frontend/lib/sanitize-rich-html.test.mjs`

- [x] Add failing tests for `table`, `thead`, `tbody`, `tr`, `th`, `td`, `colgroup`, `col` and safe fields `colspan`, `rowspan`, `scope`, `colwidth`, `width`.
- [x] Require removal of class, style, event handlers, forged wrapper role/aria/tabindex, unsafe data attributes, scripts, and javascript URLs.
- [x] Add `colgroup`/`col` narrowly. Validate width as numeric/pixel/percentage and only on table/col elements; do not globally permit arbitrary width/style.
- [x] Run sanitizer tests. Commit with Task 4–5 so this contract is delivered with its consumer.

---

### Task 4: Add Trusted Responsive Wrappers

**Files:**
- Create: `frontend/lib/text.test.mjs`
- Modify: `frontend/lib/text.ts`

**Interface:**

```ts
export function withResponsiveTables(html: string): string;
```

- [x] Add failing tests for one table, multiple independent tables, unchanged non-table HTML, and no resurrection of unsafe attributes.
- [x] Wrap each already-sanitized table in fixed application-owned markup:

```html
<div class="rich-table-scroll" role="region" aria-label="Scrollable data table" tabindex="0">...</div>
```

- [x] Do not make wrapper attributes configurable from stored HTML and do not claim this helper sanitizes.
- [x] Run Node tests and TypeScript check.

---

### Task 5: Integrate and Style Article Tables

**Files:**
- Create: `frontend/components/blog/RichContentTables.test.mjs`
- Modify: `frontend/components/BlogPostPage.tsx`
- Modify: `frontend/app/globals.css`
- Include Task 3–4 files.

- [x] Add failing integration assertions for this exact order:

```text
sanitizeRichHtml -> withTableOfContents -> withResponsiveTables -> render
```

- [x] Add stable `rich-content` scope and remove only conflicting inline Tailwind table selectors.
- [x] Add scoped styles for region-only horizontal scroll, contained overscroll, border/radius/shadow, visible focus, separate borders, min width, compact paragraph margins, long-value wrapping, zebra/hover rows, and responsive padding.
- [x] Style `<th>` inside `<tbody>` as a header, not only `thead`, because that is TipTap’s observed output.
- [x] Run:

```powershell
node --test frontend/components/blog/ComparisonTable.test.mjs frontend/components/blog/RichContentTables.test.mjs frontend/lib/text.test.mjs frontend/lib/sanitize-rich-html.test.mjs
npm --prefix frontend exec -- tsc --noEmit
npm --prefix frontend exec -- eslint components/BlogPostPage.tsx components/blog/ComparisonTable.tsx lib/text.ts lib/sanitize-rich-html.ts
npm --prefix frontend run build
```

- [x] Commit all responsive-table files as `feat(frontend): render rich content tables responsively`.

---

### Task 6: Browser and Security Verification

- [x] Test 8+ columns, tbody header cells, colspan/rowspan, column widths, links, bold text, and a long URL at 360×800, 768×900, and 1280×900.
- [x] Confirm only each table region scrolls; page/article do not overflow.
- [x] Confirm focus ring, keyboard scrolling, multiple independent wrappers, and unchanged non-table posts.
- [x] Inject forged wrapper/classes/styles/events/javascript URL and confirm they are stripped before exactly one trusted wrapper is added.
- [x] Run all admin tests/build, targeted frontend tests/build, backend comparison test, GitNexus detect-changes, and final diff review.
- [x] Confirm no migration or backend production file changed.

## Definition of Done

1. EN/VI alt labels exist and optional copy has one parenthesis pair.
2. Comparison images use saved alt with product-name fallback.
3. Required TipTap structure/width metadata survives narrow sanitization.
4. Untrusted classes/styles/events/wrappers remain blocked.
5. Article tables are readable, rounded, focusable, and mobile-scrollable without page overflow.
