# Task 7 Review Fix 1 Report

## Review findings addressed

- Wired payment-method UI copy in `SecretCredentialInput`, `GatewayForm`, and `PaymentMethodsPage` through `payment_methods.*` EN/VI locale keys.
- Added translated candidate-credential reveal/hide labels.
- Localized mode options, override actions/statuses, safe configuration hints, clear confirmation/warning, fallback errors, save action, and gateway display names.
- Preserved the exact required Vietnamese clear warning:

  `Xóa giá trị ghi đè trong cơ sở dữ liệu — trường này sẽ quay về cấu hình môi trường nếu có. Thao tác này không xóa hoặc vô hiệu hóa giá trị môi trường.`

- Changed `AppRoutes` finance routes to use the shared `canAccessFinance` predicate.
- Added fail-closed route coverage for `customer`, unknown, and empty role arrays.

## GitNexus

- Pre-edit upstream impact: LOW for `AppRoutes`, `SecretCredentialInput`, `GatewayForm`, `PaymentMethodsPage`, and `canAccessFinance`; no affected indexed execution processes.
- Working-tree `detect_changes`: LOW, 21 indexed symbols across the current checkout, 0 affected processes. Unrelated pre-existing instruction-file changes were not staged.
- Staged `detect_changes`: see commit verification below; only the Task 7 fix files and this report were staged.

## TDD evidence

RED command:

```bash
cd admin && npx vitest run src/features/payment-methods/SecretCredentialInput.test.tsx src/features/payment-methods/GatewayForm.test.tsx src/features/payment-methods/PaymentMethodsPage.test.tsx src/App.test.ts
```

Expected failures observed for untranslated secret controls/warning, untranslated mode options, and API gateway labels being rendered instead of locale labels.

GREEN focused verification:

```bash
cd admin && npx vitest run src/App.test.ts src/navigation/adminNavigation.test.tsx src/features/payment-methods
```

Result: PASS — 7 files, 100 tests.

```bash
cd admin && npx tsc --noEmit
```

Result: PASS.

```bash
cd admin && npm run build
```

Result: PASS — TypeScript project build and Vite production bundle completed.

## Return contract

Payment-method administration now renders its owned UI copy from the EN/VI locale dictionaries, including the exact Vietnamese database-override warning. Finance route authorization uses the same `canAccessFinance` policy as navigation and fails closed for customer, unknown, and empty roles. No unrelated working-tree files are included in the commit.
