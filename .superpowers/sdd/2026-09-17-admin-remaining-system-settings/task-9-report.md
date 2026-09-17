# Task 9 Report — Settings page, route, navigation, and bilingual copy

## Base

- Required HEAD: `ecc1ac8`
- Branch: `feat/admin-remaining-system-settings`

## TDD evidence

RED command:

```text
cd admin && npx vitest run src/features/settings/SettingsPage.test.tsx src/App.test.ts src/navigation/adminNavigation.test.tsx
```

Observed expected failures:

- `SettingsPage.tsx` did not exist.
- `/system/settings` fell back to the dashboard for core admins.
- System navigation lacked `/system/settings`.

GREEN/final verification:

```text
cd admin && npx vitest run src/features/settings/ src/App.test.ts src/navigation/adminNavigation.test.tsx
```

Result: 9 files passed, 146 tests passed.

```text
cd admin && npx tsc --noEmit
```

Result: exit 0, no output.

```text
cd admin && npm run build
```

Result: exit 0; Vite transformed 3125 modules and emitted `SettingsPage` chunk. Existing Vite native-config warnings remain unrelated.

## Implementation

- Added `SettingsPage` with fixed General, Branding, Analytics, SMTP, AI order.
- Only active form is mounted; tab switching unmounts request-scoped credential candidates.
- Added lazy `/system/settings` route inside existing `isCoreAdmin` route block.
- Added Settings last in System navigation, after Activity Logs.
- Added core-role route tests and fail-closed tests for Product Manager, Order Manager, Support, customer, unknown, and empty roles.
- Added exact System navigation order assertion.
- Added complete EN/VI settings namespaces and required-key completeness test.
- Removed `defaultValue` hardcoded copy from new settings components and localized AI provider labels plus SMTP encryption labels.

## GitNexus

Pre-edit impacts:

- `AppRoutes`: LOW, 0 callers/processes.
- `ADMIN_NAV_GROUPS`: LOW, 0 callers/processes.
- Five settings forms and `SecretSettingInput`: LOW, 0 callers/processes.
- Locale symbol-name queries were ambiguous but reported LOW; JSON locale changes are covered by explicit completeness tests.

Staged detect_changes:

- Risk: MEDIUM.
- 20 changed symbols, 1 affected process.
- Affected process: `AiSettingsForm → BaselineValue`, intentionally covered by the full AI form suite.
- No HIGH/CRITICAL finding.

## Scope

Only Task 9 admin files and this report are committed. Pre-existing dirty/untracked files remain untouched.
