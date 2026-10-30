# Admin Login — Mobile Layout Polish (handoff for Codex)

## Context

Screenshot review of `https://admin.petposture.com/` on a mobile viewport flagged 3 issues:
1. Default admin UI language should be English, not Vietnamese.
2. On mobile, the login form felt pushed too low / too much empty space below it.
3. Whether to redesign the mobile login more substantially — resolved via a mockup comparison; decision was to keep the current component structure and ship a lightweight positioning fix instead of a full redesign.

Mockup comparison (Before / After / Concept) was reviewed and approved: keep the "After" (top-anchored) treatment, with one extra tweak (item 3 below).

## Already done this session (uncommitted — verify, don't redo)

1. **`admin/src/i18n.ts`** — default language changed from `'vi'` to `'en'`:
   - line 7: `return localStorage.getItem('language') || 'en';`
   - line 18: `fallbackLng: 'en',`
   - Only affects users with no prior `localStorage.language` saved; existing users keep their saved choice.

2. **`admin/src/features/auth/LoginPage.tsx:51`** — form-wrapper div changed from vertically centered to top-anchored on mobile, desktop untouched:
   ```
   className="relative flex w-full flex-col items-center justify-start px-4 pt-20 pb-12 sm:px-6 lg:w-1/2 lg:justify-center lg:px-8 lg:py-12"
   ```

## New change to apply

3. **`admin/src/features/auth/LoginPage.tsx:84`** — the mobile-only logo block needs extra top breathing room, per the approved mockup. Change:
   ```tsx
   <div className="flex lg:hidden items-center justify-center mb-8">
   ```
   to:
   ```tsx
   <div className="flex lg:hidden items-center justify-center mt-10 mb-8">
   ```
   (`mt-10` = 40px). This div is already `lg:hidden`, so the added `mt-10` only ever applies on mobile — no responsive prefix needed.

## Explicitly do NOT change

- The language toggle's active-state color (`bg-primary text-white shadow` at `LoginPage.tsx:61-62,71-72`). User confirmed: keep as-is, do not switch it to orange/brand-accent.
- Anything on the desktop (`lg:*`) layout — it must stay exactly as it is today (vertically centered split-screen).
- No backend changes are involved in this task — don't touch `backend/`.

## Verification

- `cd admin && pnpm dev` (or `npm run dev`), open `http://localhost:5173` with a mobile viewport in DevTools (e.g. iPhone 13, ~390×844).
- Clear site data / localStorage first, reload → language toggle should default to **EN** highlighted.
- Confirm the form now sits near the top with a visible ~40px gap above the PetPosture mobile logo (vs. the old centered layout), and there's no large empty band below the Login button.
- Resize to ≥1024px width → confirm the split-screen desktop layout is pixel-identical to before (brand column left, centered form right).
- Check `admin/` for any existing tests touching `LoginPage` or `i18n` (e.g. `*.test.tsx`) and run them if present.

## Commit

- Stage only the touched files by name:
  ```
  git add admin/src/i18n.ts admin/src/features/auth/LoginPage.tsx
  ```
- Do **not** sweep in unrelated pre-existing modified/untracked files (`AGENTS.md`, `CLAUDE.md`, `docs/PLAN-*.md`, `frontend/*`, etc. — these predate this task and are out of scope).
- Suggested commit message:
  ```
  fix(admin): default login UI to English and fix mobile form position

  - i18n: default/fallback language en instead of vi for new sessions
  - LoginPage: top-anchor the form on mobile instead of vertical-centering
    (was reading as pushed too low on tall screens), plus extra top
    margin on the mobile logo per reviewed mockup

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  ```
