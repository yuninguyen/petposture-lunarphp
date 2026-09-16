# Admin Finance Payment Methods Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a zero-credential-exposure Laravel API and React admin page for safely viewing, testing, updating, and clearing Stripe, PayPal, Airwallex, and Payoneer configuration.

**Architecture:** Add a thin `PaymentMethodController` backed by one data-driven `PaymentMethodService`; candidate tests stay request-scoped and never use checkout-service caches. Add a feature-local React API, gateway form, and secret input with independent dirty/test revision state, then wire the page into the existing core-admin Finance route and navigation.

**Tech Stack:** PHP 8.3, Laravel 11, PHPUnit 12, Laravel HTTP client, React 18, TypeScript 5.6, TanStack Query 5, React Testing Library, Vitest 4, i18next.

**Spec:** `docs/superpowers/specs/2026-09-16-admin-finance-payment-methods-design.md`

## Global Constraints

- React exposes exactly four gateways: `stripe`, `paypal`, `airwallex`, and `payoneer`; do not expose PingPong.
- Do not modify or remove `backend/app/Filament/Pages/Payment.php`.
- Do not alter checkout behavior or introduce a real Payoneer connectivity request.
- Stored secrets must never reach an API response, rendered text, masked placeholder, log, toast, URL, browser storage, or React Query cache.
- Candidate test resolution order is candidate → database override → environment/config fallback.
- Secret omission or an empty secret preserves the current value; only `clear_fields` removes a database override.
- Clear restores environment fallback when available and must use the approved warning copy.
- Provider rejection returns `422`; transport/timeout failure returns `502`; provider raw errors are never returned or logged.
- PayPal and Airwallex updates always evict both sandbox and live access-token cache keys.
- Test-before-save is UI-only; do not add backend verification tokens.
- Connection-test invalidation uses independent revision state, not one linear enum.
- Use TDD: write each failing test before its implementation and run the focused test both before and after.
- Before editing any existing function/class/method, run `npx gitnexus impact -r petposture -d upstream --depth 3 --include-tests <symbol>` and report the result; stop for user confirmation if risk is HIGH or CRITICAL.
- Before every commit, run GitNexus `detect_changes` for staged changes and review affected flows.
- Preserve all pre-existing dirty/untracked files. Stage only files named by the current task; never use `git add -A` or `git add .`.

## File Map

### Backend files

- Create `backend/app/Services/Admin/PaymentMethodService.php`: gateway registry, safe resolution, update/clear logic, cache eviction, and request-scoped provider tests.
- Create `backend/app/Http/Requests/Admin/UpdatePaymentMethodRequest.php`: dynamic allowlist validation for update payloads and replacement/clear conflicts.
- Create `backend/app/Http/Requests/Admin/TestPaymentMethodRequest.php`: dynamic allowlist validation for connection-test candidates.
- Create `backend/app/Http/Controllers/Api/Admin/PaymentMethodController.php`: thin JSON endpoint adapter.
- Modify `backend/routes/api.php`: import the controller and register three admin routes with a gateway regex.
- Create `backend/tests/Feature/Api/Admin/PaymentMethodControllerTest.php`: authorization, safe GET, update, cache, provider, logging, and checkout-resolution regression coverage.

### React admin files

- Create `admin/src/features/payment-methods/api.ts`: exact API types and GET/PUT/POST wrappers.
- Create `admin/src/features/payment-methods/SecretCredentialInput.tsx`: blank candidate input plus safe source metadata and remove-override action.
- Create `admin/src/features/payment-methods/GatewayForm.tsx`: independent dirty/revision/clear/test state and mutations.
- Create `admin/src/features/payment-methods/PaymentMethodsPage.tsx`: query, responsive gateway selector, safe page composition, and candidate reset on gateway switch.
- Create `admin/src/features/payment-methods/api.test.ts`: endpoint and payload contract tests.
- Create `admin/src/features/payment-methods/SecretCredentialInput.test.tsx`: blank/reveal/remove behavior without stored-secret rendering.
- Create `admin/src/features/payment-methods/GatewayForm.test.tsx`: test-before-save, combined change axes, clear, and candidate reset tests.
- Create `admin/src/features/payment-methods/PaymentMethodsPage.test.tsx`: four-gateway rendering and browser-to-Laravel-only coverage.
- Modify `admin/src/App.tsx`: lazy import and guarded `/finance/payment-methods` route.
- Modify `admin/src/App.test.ts`: route authorization coverage.
- Modify `admin/src/navigation/adminNavigation.tsx`: Finance navigation item after Goals.
- Modify `admin/src/navigation/adminNavigation.test.tsx`: Finance item and role visibility expectations.
- Modify `admin/src/locales/en.json`: complete English copy.
- Modify `admin/src/locales/vi.json`: complete Vietnamese copy.

---

### Task 1: Safe Backend Read API

**Files:**
- Create: `backend/app/Services/Admin/PaymentMethodService.php`
- Create: `backend/app/Http/Controllers/Api/Admin/PaymentMethodController.php`
- Modify: `backend/routes/api.php`
- Test: `backend/tests/Feature/Api/Admin/PaymentMethodControllerTest.php`

**Interfaces:**
- Produces: `PaymentMethodService::all(): array`
- Produces: `PaymentMethodService::describe(string $gateway): array`
- Produces: `PaymentMethodService::hasGateway(string $gateway): bool`
- Produces safe gateway shape used by all later backend and frontend tasks:

```php
[
    'gateway' => 'stripe',
    'label' => 'Stripe',
    'configured' => true,
    'source' => 'mixed',
    'mode' => 'test',
    'webhook_url' => 'http://localhost/api/webhooks/stripe',
    'fields' => [
        'stripe_key' => ['value' => 'pk_test_safe', 'configured' => true, 'source' => 'environment'],
        'stripe_secret' => ['configured' => true, 'source' => 'database', 'hint' => 'Configured in database'],
    ],
]
```

- [ ] **Step 1: Run impact analysis for the existing route file boundary**

Run:

```bash
npx gitnexus context -r petposture -f backend/routes/api.php api.php
```

Record that this task adds routes only and does not modify `EnforceAdminApiPermission` or Filament Payment.

- [ ] **Step 2: Write failing authorization and safe-read tests**

Create `PaymentMethodControllerTest.php` with `RefreshDatabase`, seed `RoleSeeder`, and helpers `actingAsRole(string $role)` and `setPaymentConfigToNull()`.

Add tests with these exact assertions:

```php
public function test_payment_method_index_requires_authentication(): void
{
    $this->getJson('/api/admin/finance/payment-methods')->assertUnauthorized();
}

public function test_only_core_admin_roles_can_access_payment_methods(): void
{
    foreach (['customer', 'Product Manager', 'Order Manager', 'Support'] as $role) {
        Sanctum::actingAs($this->userWithRole($role));
        $this->getJson('/api/admin/finance/payment-methods')->assertForbidden();
    }

    foreach (['super_admin', 'admin', 'staff'] as $role) {
        Sanctum::actingAs($this->userWithRole($role));
        $this->getJson('/api/admin/finance/payment-methods')->assertOk();
    }
}

public function test_index_returns_four_gateways_with_safe_field_metadata(): void
{
    config()->set('services.stripe.key', 'pk_test_environment_safe');
    config()->set('services.stripe.secret', 'sk_test_environment_must_not_leak');
    Setting::set('stripe_secret', 'sk_test_database_must_not_leak', 'string', 'payment');

    Sanctum::actingAs($this->userWithRole('admin'));
    $response = $this->getJson('/api/admin/finance/payment-methods')->assertOk();

    $this->assertSame(['stripe', 'paypal', 'airwallex', 'payoneer'],
        collect($response->json('data'))->pluck('gateway')->all());
    $response->assertJsonPath('data.0.source', 'mixed');
    $response->assertJsonPath('data.0.fields.stripe_key.value', 'pk_test_environment_safe');
    $response->assertJsonPath('data.0.fields.stripe_secret.source', 'database');
    $response->assertJsonMissingPath('data.0.fields.stripe_secret.value');

    $raw = $response->getContent();
    $this->assertStringNotContainsString('sk_test_database_must_not_leak', $raw);
    $this->assertStringNotContainsString('sk_test_environment_must_not_leak', $raw);
    $this->assertStringNotContainsString('********', $raw);
}
```

Also add one data-provider test for gateway source states `database`, `environment`, `mixed`, and `none`, and assert webhook URLs end in `/api/webhooks/{gateway}`.

- [ ] **Step 3: Run the focused tests and verify failure**

Run:

```bash
cd backend && php artisan test tests/Feature/Api/Admin/PaymentMethodControllerTest.php
```

Expected: FAIL because the routes/controller/service do not exist.

- [ ] **Step 4: Implement the data-driven registry and safe resolver**

Create `PaymentMethodService` with a single registry shaped as follows:

```php
private const GATEWAYS = [
    'stripe' => [
        'label' => 'Stripe',
        'mode' => ['key' => 'stripe_mode', 'config' => null, 'default' => 'live', 'values' => ['test', 'live']],
        'required' => ['stripe_secret'],
        'fields' => [
            'stripe_key' => ['secret' => false, 'config' => 'services.stripe.key', 'test' => false],
            'stripe_secret' => ['secret' => true, 'config' => 'services.stripe.secret', 'test' => true],
            'stripe_webhook_secret' => ['secret' => true, 'config' => 'services.stripe.webhook_secret', 'test' => false],
        ],
        'cache_keys' => ['stripe_key', 'stripe_secret', 'stripe_webhook_secret'],
    ],
    'paypal' => [
        'label' => 'PayPal',
        'mode' => ['key' => 'paypal_mode', 'config' => 'services.paypal.mode', 'default' => 'sandbox', 'values' => ['sandbox', 'live']],
        'required' => ['paypal_client_id', 'paypal_client_secret'],
        'fields' => [
            'paypal_client_id' => ['secret' => false, 'config' => 'services.paypal.client_id', 'test' => true],
            'paypal_client_secret' => ['secret' => true, 'config' => 'services.paypal.client_secret', 'test' => true],
            'paypal_webhook_id' => ['secret' => true, 'config' => 'services.paypal.webhook_id', 'test' => false],
        ],
        'cache_keys' => ['paypal_client_id', 'paypal_client_secret', 'paypal_mode', 'paypal_webhook_id', 'paypal_access_token_sandbox', 'paypal_access_token_live'],
    ],
    'airwallex' => [
        'label' => 'Airwallex',
        'mode' => ['key' => 'airwallex_mode', 'config' => 'services.airwallex.mode', 'default' => 'sandbox', 'values' => ['sandbox', 'live']],
        'required' => ['airwallex_client_id', 'airwallex_api_key'],
        'fields' => [
            'airwallex_client_id' => ['secret' => false, 'config' => 'services.airwallex.client_id', 'test' => true],
            'airwallex_api_key' => ['secret' => true, 'config' => 'services.airwallex.api_key', 'test' => true],
            'airwallex_webhook_secret' => ['secret' => true, 'config' => 'services.airwallex.webhook_secret', 'test' => false],
        ],
        'cache_keys' => ['airwallex_client_id', 'airwallex_api_key', 'airwallex_webhook_secret', 'airwallex_mode', 'airwallex_access_token_sandbox', 'airwallex_access_token_live'],
    ],
    'payoneer' => [
        'label' => 'Payoneer',
        'mode' => ['key' => 'payoneer_mode', 'config' => 'services.payoneer.mode', 'default' => 'sandbox', 'values' => ['sandbox', 'live']],
        'required' => ['payoneer_merchant_code', 'payoneer_api_key', 'payoneer_api_secret'],
        'fields' => [
            'payoneer_merchant_code' => ['secret' => false, 'config' => 'services.payoneer.merchant_code', 'test' => true],
            'payoneer_api_key' => ['secret' => true, 'config' => 'services.payoneer.api_key', 'test' => true],
            'payoneer_api_secret' => ['secret' => true, 'config' => 'services.payoneer.api_secret', 'test' => true],
            'payoneer_webhook_secret' => ['secret' => true, 'config' => 'services.payoneer.webhook_secret', 'test' => false],
        ],
        'cache_keys' => ['payoneer_merchant_code', 'payoneer_api_key', 'payoneer_api_secret', 'payoneer_webhook_secret', 'payoneer_mode'],
    ],
];
```

Implement private helpers with these signatures:

```php
private function definition(string $gateway): array;
private function databaseValues(array $keys): Collection;
private function effectiveField(string $key, array $field, Collection $database): array;
private function effectiveMode(array $definition, Collection $database): string;
private function aggregateSource(array $fields): string;
private function safeHint(string $source): string;
```

Use a direct Setting query to distinguish row existence/source; treat null/empty database values as absent so fallback remains consistent with `Setting::get(...) ?: config(...)`. Exclude the mode field from credential field metadata and gateway source aggregation.

- [ ] **Step 5: Implement the thin controller and routes**

Create the Task 1 controller method:

```php
public function index(PaymentMethodService $paymentMethods): JsonResponse;
```

Register only the GET route. Tasks 2 and 3 add their controller methods and PUT/POST routes when the request classes exist. Register now:

```php
Route::get('/finance/payment-methods', [PaymentMethodController::class, 'index']);
```

Unknown gateway slugs must return `404` from route matching.

- [ ] **Step 6: Run focused backend tests**

Run:

```bash
cd backend && php artisan test tests/Feature/Api/Admin/PaymentMethodControllerTest.php
```

Expected: GET authorization and safe-read tests PASS.

- [ ] **Step 7: Run staged change detection and commit**

Stage only:

```bash
git add backend/app/Services/Admin/PaymentMethodService.php backend/app/Http/Controllers/Api/Admin/PaymentMethodController.php backend/routes/api.php backend/tests/Feature/Api/Admin/PaymentMethodControllerTest.php
```

Run GitNexus `detect_changes` with `scope: staged`, confirm only the new payment-method API and route surface are affected, then commit:

```bash
git commit -m "feat(admin): add safe payment methods read API"
```

---

### Task 2: Explicit Updates, Clears, and Cache Invalidation

**Files:**
- Create: `backend/app/Http/Requests/Admin/UpdatePaymentMethodRequest.php`
- Modify: `backend/app/Services/Admin/PaymentMethodService.php`
- Modify: `backend/app/Http/Controllers/Api/Admin/PaymentMethodController.php`
- Test: `backend/tests/Feature/Api/Admin/PaymentMethodControllerTest.php`

**Interfaces:**
- Consumes: `PaymentMethodService::describe()` and the Task 1 registry.
- Produces: `PaymentMethodService::fieldNames(string $gateway): array`
- Produces: `PaymentMethodService::modeValues(string $gateway): array`
- Produces: `PaymentMethodService::update(string $gateway, array $payload): array`
- `UpdatePaymentMethodRequest::validated()` returns:

```php
[
    'mode' => 'live', // optional
    'fields' => ['stripe_key' => 'pk_live_new', 'stripe_secret' => 'sk_live_new'], // optional
    'clear_fields' => ['stripe_webhook_secret'], // optional
]
```

- [ ] **Step 1: Write failing update semantics tests**

Add tests for:

```php
public function test_payment_method_update_requires_authentication_and_core_admin_role(): void;
public function test_unknown_payment_gateway_update_returns_not_found(): void;
public function test_update_omission_and_empty_secret_preserve_existing_values(): void;
public function test_update_replaces_only_allowlisted_fields_and_returns_no_secret(): void;
public function test_clear_fields_deletes_database_override_and_restores_environment_fallback(): void;
public function test_update_rejects_arbitrary_fields_and_replace_clear_conflicts(): void;
public function test_unauthorized_update_does_not_change_settings(): void;
public function test_update_evicts_every_raw_gateway_cache_key(): void;
```

The cache test must preload all registered keys with sentinel values and assert `Cache::has($key)` is false after update. Include both token keys for PayPal/Airwallex and all five Payoneer keys.

The fallback test must set an environment config sentinel, store a different database sentinel, clear the field, assert the Setting row is absent, and assert the safe response reports `environment` without containing either secret.

- [ ] **Step 2: Run the focused tests and verify failure**

Run:

```bash
cd backend && php artisan test tests/Feature/Api/Admin/PaymentMethodControllerTest.php --filter=update
```

Expected: FAIL because update validation and persistence are not implemented.

- [ ] **Step 3: Implement dynamic update validation**

In `UpdatePaymentMethodRequest`, inject `PaymentMethodService` inside `rules()` and build exact rules:

```php
public function rules(): array
{
    $gateway = (string) $this->route('gateway');
    $fields = $this->paymentMethods->fieldNames($gateway);

    $rules = [
        'mode' => ['sometimes', 'string', Rule::in($this->paymentMethods->modeValues($gateway))],
        'fields' => ['sometimes', 'array:'.implode(',', $fields)],
        'clear_fields' => ['sometimes', 'array'],
        'clear_fields.*' => ['string', 'distinct', Rule::in($fields)],
    ];

    foreach ($fields as $field) {
        $rules["fields.{$field}"] = ['sometimes', 'nullable', 'string'];
    }

    return $rules;
}
```

Add an `after()` validator callback that rejects a field present with a non-empty replacement and also present in `clear_fields`. Authorization returns `true`; route middleware owns access control.

- [ ] **Step 4: Implement update and raw cache eviction**

Implement `PaymentMethodService::update()` using only allowlisted definitions:

```php
foreach (($payload['fields'] ?? []) as $key => $value) {
    if (is_string($value) && trim($value) !== '') {
        Setting::set($key, $value, 'string', 'payment');
    }
}

if (array_key_exists('mode', $payload)) {
    Setting::set($definition['mode']['key'], $payload['mode'], 'string', 'payment');
}

foreach (($payload['clear_fields'] ?? []) as $key) {
    Setting::query()->where('key', $key)->delete();
}

foreach ($definition['cache_keys'] as $cacheKey) {
    Cache::forget($cacheKey);
}

return $this->describe($gateway);
```

Add this controller method:

```php
public function update(UpdatePaymentMethodRequest $request, string $gateway, PaymentMethodService $paymentMethods): JsonResponse;
```

It returns `['data' => $paymentMethods->update($gateway, $request->validated())]`. Add the PUT route at this task:

```php
Route::put('/finance/payment-methods/{gateway}', [PaymentMethodController::class, 'update'])
    ->where('gateway', 'stripe|paypal|airwallex|payoneer');
```

- [ ] **Step 5: Add the checkout-resolution cache regression test**

Use reflection only in the test to invoke the existing private credential resolver without changing checkout services:

```php
private function invokePrivate(object $service, string $method): mixed
{
    $reflection = new ReflectionMethod($service, $method);
    $reflection->setAccessible(true);
    return $reflection->invoke($service);
}
```

Prime raw service caches with old values, call the admin PUT endpoint with new values, then assert the existing checkout services resolve the new values. Cover Stripe `stripeSecret()`, PayPal `clientId()`, Airwallex `clientId()`, and Payoneer `merchantCode()`; the all-keys eviction test separately verifies every registered mode/webhook/access-token key.

- [ ] **Step 6: Run focused and related regression tests**

Run:

```bash
cd backend && php artisan test tests/Feature/Api/Admin/PaymentMethodControllerTest.php
cd backend && php artisan test tests/Feature/CheckoutSessionSecurityTest.php tests/Feature/PayPalApiTest.php
```

Expected: PASS with no modifications to checkout services or Filament.

- [ ] **Step 7: Run staged change detection and commit**

Stage only Task 2 files, run GitNexus staged `detect_changes`, then commit:

```bash
git add backend/app/Http/Requests/Admin/UpdatePaymentMethodRequest.php backend/app/Services/Admin/PaymentMethodService.php backend/app/Http/Controllers/Api/Admin/PaymentMethodController.php backend/tests/Feature/Api/Admin/PaymentMethodControllerTest.php
git commit -m "feat(admin): update payment method settings safely"
```

---

### Task 3: Request-Scoped Provider Connection Tests

**Files:**
- Create: `backend/app/Http/Requests/Admin/TestPaymentMethodRequest.php`
- Modify: `backend/app/Services/Admin/PaymentMethodService.php`
- Modify: `backend/app/Http/Controllers/Api/Admin/PaymentMethodController.php`
- Test: `backend/tests/Feature/Api/Admin/PaymentMethodControllerTest.php`

**Interfaces:**
- Produces: `PaymentMethodService::connectionFieldNames(string $gateway): array`
- Produces: `PaymentMethodService::testConnection(string $gateway, array $payload): array{status_code:int,data:array}`
- Result data is exactly:

```php
[
    'gateway' => 'stripe',
    'status' => 'connected',
    'message' => 'Stripe connection verified.',
    'mode' => 'live',
]
```

or Payoneer `status => credentials_present`.

- [ ] **Step 1: Write failing provider contract tests**

Add `test_payment_method_connection_test_requires_authentication_and_core_admin_role()` and `test_unknown_payment_gateway_test_returns_not_found()`. Add provider tests that use `Http::fake()` and `Http::assertSent()` to verify:

- Stripe sends `GET https://api.stripe.com/v1/account` with candidate Basic Auth.
- PayPal selects sandbox/live host, sends form `grant_type=client_credentials`, and uses candidate client ID/secret.
- Airwallex selects sandbox/live host and sends `x-client-id`/`x-api-key` candidate headers.
- Candidate wins over database and environment; omission falls back database then environment.
- Provider non-success returns `422` with only controlled text.
- `Http::failedConnection('sentinel transport secret')` returns `502` without the sentinel.
- Payoneer sends no HTTP request and returns `credentials_present` only when merchant code/API key/API secret resolve.
- Test requests never persist candidates.

Use unique candidate strings such as `candidate-secret-must-not-leak-7f31` and assert they are absent from response content and captured logs.

- [ ] **Step 2: Run provider tests and verify failure**

Run:

```bash
cd backend && php artisan test tests/Feature/Api/Admin/PaymentMethodControllerTest.php --filter=connection
```

Expected: FAIL because the test endpoint still lacks implementation.

- [ ] **Step 3: Implement dynamic candidate validation**

`TestPaymentMethodRequest` permits only `mode` and gateway connection fields:

```php
'mode' => ['sometimes', 'string', Rule::in($service->modeValues($gateway))],
'fields' => ['sometimes', 'array:'.implode(',', $service->connectionFieldNames($gateway))],
```

Each allowed candidate field is `sometimes|nullable|string`; webhook fields and arbitrary keys are rejected.

- [ ] **Step 4: Implement request-scoped credential resolution**

Add helpers:

```php
private function candidateValue(array $payload, string $key, array $field, Collection $database): string;
private function testMode(array $payload, array $definition, Collection $database): string;
private function missingRequiredTestFields(string $gateway, array $resolved): array;
```

A non-empty candidate wins. Empty/omitted candidate falls through to the same database/config resolver used by GET. Never write candidates to Setting or Cache.

- [ ] **Step 5: Implement the exact provider HTTP contracts**

Use one `match ($gateway)` with four private methods:

```php
private function testStripe(array $credentials, string $mode): array;
private function testPayPal(array $credentials, string $mode): array;
private function testAirwallex(array $credentials, string $mode): array;
private function testPayoneer(array $credentials, string $mode): array;
```

Copy the exact Filament requests from the spec. Wrap transport calls in `try/catch (ConnectionException)` and `catch (Throwable)` at the service boundary; both return controlled `502` results without logging exception messages. Non-success provider responses return controlled `422` results without reading provider error text into the response.

Add this controller method:

```php
public function test(TestPaymentMethodRequest $request, string $gateway, PaymentMethodService $paymentMethods): JsonResponse;
```

Its body returns:

```php
$result = $paymentMethods->testConnection($gateway, $request->validated());
return response()->json(['data' => $result['data']], $result['status_code']);
```

Add the POST route at this task:

```php
Route::post('/finance/payment-methods/{gateway}/test', [PaymentMethodController::class, 'test'])
    ->where('gateway', 'stripe|paypal|airwallex|payoneer');
```

- [ ] **Step 6: Verify no request-body logging or secret leakage**

Run:

```bash
cd backend && php artisan test tests/Feature/Api/Admin/PaymentMethodControllerTest.php
```

Expected: all authorization, safe read, update/cache, provider, failure-status, no-persistence, and no-leak tests PASS.

- [ ] **Step 7: Run backend formatting and static checks for touched files**

Run:

```bash
cd backend && vendor/bin/pint app/Services/Admin/PaymentMethodService.php app/Http/Controllers/Api/Admin/PaymentMethodController.php app/Http/Requests/Admin/UpdatePaymentMethodRequest.php app/Http/Requests/Admin/TestPaymentMethodRequest.php tests/Feature/Api/Admin/PaymentMethodControllerTest.php
cd backend && vendor/bin/phpstan analyse --no-progress app/Services/Admin/PaymentMethodService.php app/Http/Controllers/Api/Admin/PaymentMethodController.php app/Http/Requests/Admin/UpdatePaymentMethodRequest.php app/Http/Requests/Admin/TestPaymentMethodRequest.php
```

Expected: PASS.

- [ ] **Step 8: Run staged change detection and commit**

Stage only Task 3 files, run GitNexus staged `detect_changes`, then commit:

```bash
git add backend/app/Http/Requests/Admin/TestPaymentMethodRequest.php backend/app/Services/Admin/PaymentMethodService.php backend/app/Http/Controllers/Api/Admin/PaymentMethodController.php backend/tests/Feature/Api/Admin/PaymentMethodControllerTest.php
git commit -m "feat(admin): test payment credentials before save"
```

---

### Task 4: React API Contract and Secret Input

**Files:**
- Create: `admin/src/features/payment-methods/api.ts`
- Create: `admin/src/features/payment-methods/api.test.ts`
- Create: `admin/src/features/payment-methods/SecretCredentialInput.tsx`
- Create: `admin/src/features/payment-methods/SecretCredentialInput.test.tsx`

**Interfaces:**
- Produces types:

```ts
export type PaymentGateway = 'stripe' | 'paypal' | 'airwallex' | 'payoneer';
export type PaymentSource = 'database' | 'environment' | 'mixed' | 'none';
export interface PaymentFieldState { value?: string; configured: boolean; source: Exclude<PaymentSource, 'mixed'>; hint?: string; }
export interface PaymentMethodState { gateway: PaymentGateway; label: string; configured: boolean; source: PaymentSource; mode: string; webhook_url: string; fields: Record<string, PaymentFieldState>; }
export interface PaymentMethodUpdatePayload { mode?: string; fields?: Record<string, string>; clear_fields?: string[]; }
export interface PaymentMethodTestPayload { mode?: string; fields?: Record<string, string>; }
export interface PaymentMethodTestResult { gateway: PaymentGateway; status: 'connected' | 'credentials_present'; message: string; mode: string; }
```

- Produces API functions:

```ts
fetchPaymentMethods(): Promise<{ data: PaymentMethodState[] }>;
updatePaymentMethod(gateway: PaymentGateway, payload: PaymentMethodUpdatePayload): Promise<{ data: PaymentMethodState }>;
testPaymentMethod(gateway: PaymentGateway, payload: PaymentMethodTestPayload): Promise<{ data: PaymentMethodTestResult }>;
```

- Produces `SecretCredentialInput` props:

```ts
interface SecretCredentialInputProps {
  id: string;
  label: string;
  value: string;
  field: PaymentFieldState;
  disabled?: boolean;
  markedForClear: boolean;
  onChange(value: string): void;
  onRequestClear(): void;
}
```

- [ ] **Step 1: Write failing API wrapper tests**

Mock `fetchJson` and assert exact calls:

```ts
expect(fetchJson).toHaveBeenCalledWith('/admin/finance/payment-methods');
expect(fetchJson).toHaveBeenCalledWith('/admin/finance/payment-methods/stripe', { method: 'PUT', body: payload });
expect(fetchJson).toHaveBeenCalledWith('/admin/finance/payment-methods/paypal/test', { method: 'POST', body: payload });
```

- [ ] **Step 2: Write failing secret input tests**

Cover:

- Input starts blank even when `configured: true`.
- Status text says database/environment/not configured without a stored value.
- Reveal button reveals only a newly typed candidate.
- Remove override action appears only for `source === 'database'`.
- Clicking remove invokes `onRequestClear` and never places fake bullets in the DOM.

- [ ] **Step 3: Run focused React tests and verify failure**

Run:

```bash
cd admin && npx vitest run src/features/payment-methods/api.test.ts src/features/payment-methods/SecretCredentialInput.test.tsx
```

Expected: FAIL because files do not exist.

- [ ] **Step 4: Implement API types/wrappers and the secret input**

Use `fetchJson` exactly as existing feature APIs do. Keep the secret input controlled by the parent, default to `type="password"`, and implement local show/hide only for the current candidate. Do not copy a stored value into component state.

- [ ] **Step 5: Run focused React tests**

Run:

```bash
cd admin && npx vitest run src/features/payment-methods/api.test.ts src/features/payment-methods/SecretCredentialInput.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Run staged change detection and commit**

Stage only the four new files, run GitNexus staged `detect_changes`, then commit:

```bash
git add admin/src/features/payment-methods/api.ts admin/src/features/payment-methods/api.test.ts admin/src/features/payment-methods/SecretCredentialInput.tsx admin/src/features/payment-methods/SecretCredentialInput.test.tsx
git commit -m "feat(admin): add payment methods client contract"
```

---

### Task 5: Gateway Form Safety State and Mutations

**Files:**
- Create: `admin/src/features/payment-methods/GatewayForm.tsx`
- Create: `admin/src/features/payment-methods/GatewayForm.test.tsx`

**Interfaces:**
- Consumes Task 4 types/API and `SecretCredentialInput`.
- Produces:

```ts
interface GatewayFieldDefinition {
  key: string;
  labelKey: string;
  fallbackLabel: string;
  secret: boolean;
  connectionField: boolean;
}

interface GatewayFormProps {
  gateway: PaymentMethodState;
  onSaved(next: PaymentMethodState): void;
}
```

- Uses a feature-local complete map `GATEWAY_FORMS: Record<PaymentGateway, { modes; fields }>` to define labels, mode options, and connection fields. This map is UI metadata only and must match the backend registry/spec.

- [ ] **Step 1: Write failing independent-state tests**

Add tests for these exact behaviors:

```text
non-secret field is prefilled; secret field is blank
webhook-only change enables Save without Test
clear-only change enables Save after confirmation
mode or connection field change disables Save
successful Test enables Save
failed Test keeps Save disabled
connection change after success disables Save again
webhook change after success leaves Save enabled
connection + webhook changes save together after one successful current-revision test
blank secret is omitted from Save payload
candidate replacement and clear_fields are mutually exclusive in the generated payload
Payoneer displays credentials-present limitation rather than verified connectivity
```

Mock only Task 4 API functions, not provider domains.

- [ ] **Step 2: Run the form test and verify failure**

Run:

```bash
cd admin && npx vitest run src/features/payment-methods/GatewayForm.test.tsx
```

Expected: FAIL because `GatewayForm` does not exist.

- [ ] **Step 3: Implement independent form state**

Use these state values rather than an enum:

```ts
const [mode, setMode] = useState(gateway.mode);
const [candidates, setCandidates] = useState<Record<string, string>>({});
const [clearFields, setClearFields] = useState<Set<string>>(new Set());
const [connectionRevision, setConnectionRevision] = useState(0);
const [testedRevision, setTestedRevision] = useState<number | null>(null);
const [testResult, setTestResult] = useState<PaymentMethodTestResult | null>(null);
```

Derive dirty state by comparing mode and non-secret candidate values with `gateway`, plus non-empty secret candidates and `clearFields.size`. Increment the connection revision only when mode or a field with `connectionField: true` changes. Webhook changes and clear actions do not increment it.

Use:

```ts
const hasUntestedConnectionChanges =
  connectionRevision > 0 && testedRevision !== connectionRevision;
const canSave = hasAnyChanges && !hasUntestedConnectionChanges && !isTesting && !isSaving;
```

- [ ] **Step 4: Implement test and save payload builders**

Test payload includes current mode and only non-empty connection candidates. Save payload includes only changed mode, explicit non-empty replacements, and `Array.from(clearFields)`.

On test success, set `testedRevision(connectionRevision)` and keep the result only in component state. On save success, call `onSaved`, clear candidates/clear fields/test result, reset revisions, and repopulate from the safe response.

- [ ] **Step 5: Implement remove-override confirmation**

Use a feature-local confirmation dialog or a minimally adapted existing modal. The visible English fallback message must be exactly:

```text
Remove database override — this field will fall back to environment configuration if available. This does not remove or disable the environment value.
```

Confirming clear removes any candidate for the field. Typing a later candidate removes the field from `clearFields`.

- [ ] **Step 6: Run focused form tests**

Run:

```bash
cd admin && npx vitest run src/features/payment-methods/GatewayForm.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Run staged change detection and commit**

Stage only the form and test, run GitNexus staged `detect_changes`, then commit:

```bash
git add admin/src/features/payment-methods/GatewayForm.tsx admin/src/features/payment-methods/GatewayForm.test.tsx
git commit -m "feat(admin): enforce payment test before save"
```

---

### Task 6: Payment Methods Page Composition

**Files:**
- Create: `admin/src/features/payment-methods/PaymentMethodsPage.tsx`
- Create: `admin/src/features/payment-methods/PaymentMethodsPage.test.tsx`

**Interfaces:**
- Consumes: `fetchPaymentMethods()`, `PaymentMethodState`, and `GatewayForm`.
- Produces: named export `PaymentMethodsPage` for lazy routing.

- [ ] **Step 1: Write failing page tests**

Mock `fetchJson` with four safe gateway fixtures and assert:

- Stripe, PayPal, Airwallex, and Payoneer selectors render.
- PingPong does not render.
- Selecting a new gateway replaces the form and clears the previous candidate input.
- Loading and error states are accessible.
- Every captured request URL starts with `/admin/finance/payment-methods`; no request contains `stripe.com`, `paypal.com`, `airwallex.com`, or `payoneer.com`.
- Fixture sentinel secrets do not occur in `container.innerHTML`.

- [ ] **Step 2: Run page tests and verify failure**

Run:

```bash
cd admin && npx vitest run src/features/payment-methods/PaymentMethodsPage.test.tsx
```

Expected: FAIL because the page does not exist.

- [ ] **Step 3: Implement page query and responsive gateway selection**

Use TanStack Query key `['admin', 'payment-methods']`. Keep selected gateway as a slug, render tabs/buttons on desktop and a `<select>` on narrow layouts, and key the form by gateway slug so switching gateways unmounts the old sensitive state:

```tsx
<GatewayForm
  key={selected.gateway}
  gateway={selected}
  onSaved={(next) => queryClient.setQueryData(queryKey, replaceGateway(next))}
/>
```

Do not store candidates at page/query level.

- [ ] **Step 4: Run page and feature tests**

Run:

```bash
cd admin && npx vitest run src/features/payment-methods
```

Expected: PASS.

- [ ] **Step 5: Run staged change detection and commit**

Stage only the page files, run GitNexus staged `detect_changes`, then commit:

```bash
git add admin/src/features/payment-methods/PaymentMethodsPage.tsx admin/src/features/payment-methods/PaymentMethodsPage.test.tsx
git commit -m "feat(admin): add payment methods page"
```

---

### Task 7: Core-Admin Route, Finance Navigation, and Bilingual Copy

**Files:**
- Modify: `admin/src/App.tsx`
- Modify: `admin/src/App.test.ts`
- Modify: `admin/src/navigation/adminNavigation.tsx`
- Modify: `admin/src/navigation/adminNavigation.test.tsx`
- Modify: `admin/src/locales/en.json`
- Modify: `admin/src/locales/vi.json`

**Interfaces:**
- Consumes: `PaymentMethodsPage` named export.
- Produces route `/finance/payment-methods` and navigation key `payment-methods` using `canAccessFinance`.

- [ ] **Step 1: Run required impact analyses immediately before edits**

Run:

```bash
npx gitnexus impact -r petposture -d upstream --depth 3 --include-tests AppRoutes
npx gitnexus impact -r petposture -d upstream --depth 3 --include-tests ADMIN_NAV_GROUPS
npx gitnexus impact -r petposture -d upstream --depth 3 --include-tests canAccessFinance
```

Expected based on design-time analysis: LOW risk. Report direct callers/tests before editing.

- [ ] **Step 2: Write failing route/navigation tests**

In `App.test.ts`, mock `PaymentMethodsPage` and assert `/finance/payment-methods` renders for each core role and redirects Product Manager/Order Manager/Support to their safe home route.

In `adminNavigation.test.tsx`, change the Finance expectation to:

```ts
expect(financeItems).toEqual(['/goals', '/finance/payment-methods']);
```

Assert non-core role visibility remains unchanged.

- [ ] **Step 3: Run route/navigation tests and verify failure**

Run:

```bash
cd admin && npx vitest run src/App.test.ts src/navigation/adminNavigation.test.tsx
```

Expected: FAIL because the route/item do not exist.

- [ ] **Step 4: Add lazy route and Finance navigation item**

Add:

```ts
const PaymentMethodsPage = lazy(() =>
  import('@/features/payment-methods/PaymentMethodsPage').then((m) => ({ default: m.PaymentMethodsPage }))
);
```

Inside the existing `isCoreAdmin` route block add:

```tsx
<Route path="/finance/payment-methods" element={<PaymentMethodsPage />} />
```

Add the Finance item immediately after Goals with `canAccess: canAccessFinance` and a credit-card icon.

- [ ] **Step 5: Add complete EN/VI keys**

Add a consistent `payment_methods.*` namespace covering page title/subtitle, four gateway names, all field labels, mode labels, source/configured badges, secret hints, actions, loading/error states, remove confirmation, provider rejection/network messages, Save/Test success, and Payoneer limitation. Add `nav.payment_methods` in both locales.

Use the approved Vietnamese meaning for the clear warning:

```text
Xóa giá trị ghi đè trong cơ sở dữ liệu — trường này sẽ quay về cấu hình môi trường nếu có. Thao tác này không xóa hoặc vô hiệu hóa giá trị môi trường.
```

- [ ] **Step 6: Run route, navigation, i18n, and feature tests**

Run:

```bash
cd admin && npx vitest run src/App.test.ts src/navigation/adminNavigation.test.tsx src/features/payment-methods
```

Expected: PASS.

- [ ] **Step 7: Run TypeScript build**

Run:

```bash
cd admin && npm run build
```

Expected: `tsc -b` and Vite build PASS.

- [ ] **Step 8: Run staged change detection and commit**

Stage only the six Task 7 files, run GitNexus staged `detect_changes`, then commit:

```bash
git add admin/src/App.tsx admin/src/App.test.ts admin/src/navigation/adminNavigation.tsx admin/src/navigation/adminNavigation.test.tsx admin/src/locales/en.json admin/src/locales/vi.json
git commit -m "feat(admin): route payment methods under finance"
```

---

### Task 8: Full Security and Regression Verification

**Files:**
- Modify only if a failing verification exposes a Phase 4 defect: files already created/modified in Tasks 1–7.
- Do not edit Filament or checkout services to make unrelated tests pass.

**Interfaces:**
- Verifies the complete spec and release gate; produces no new public interface.

- [ ] **Step 1: Run the complete focused backend suite**

Run:

```bash
cd backend && php artisan test tests/Feature/Api/Admin/PaymentMethodControllerTest.php tests/Feature/AdminPermissionMatrixTest.php tests/Feature/PaymentPageRendersTest.php tests/Feature/CheckoutSessionSecurityTest.php tests/Feature/PayPalApiTest.php
```

Expected: PASS. `PaymentPageRendersTest` confirms Filament remains intact.

- [ ] **Step 2: Run the complete admin test suite**

Run:

```bash
cd admin && npm test
```

Expected: PASS.

- [ ] **Step 3: Run backend format/static analysis and admin build**

Run:

```bash
cd backend && vendor/bin/pint --test app/Services/Admin/PaymentMethodService.php app/Http/Controllers/Api/Admin/PaymentMethodController.php app/Http/Requests/Admin/UpdatePaymentMethodRequest.php app/Http/Requests/Admin/TestPaymentMethodRequest.php tests/Feature/Api/Admin/PaymentMethodControllerTest.php
cd backend && vendor/bin/phpstan analyse --no-progress app/Services/Admin/PaymentMethodService.php app/Http/Controllers/Api/Admin/PaymentMethodController.php app/Http/Requests/Admin/UpdatePaymentMethodRequest.php app/Http/Requests/Admin/TestPaymentMethodRequest.php
cd admin && npm run build
```

Expected: PASS.

- [ ] **Step 4: Run explicit leak scans over Phase 4 source and tests**

Run repository searches for accidental fake masks/provider-browser calls:

```bash
rg -n "\*\*\*\*|sk_live_|sk_test_|paypal\.com|stripe\.com|airwallex\.com|payoneer\.com" admin/src/features/payment-methods
rg -n "request\(\)->all|Log::|logger\(" backend/app/Services/Admin/PaymentMethodService.php backend/app/Http/Controllers/Api/Admin/PaymentMethodController.php
```

Expected: no stored-secret literals or browser provider calls in production React code; backend contains no request-payload logging. Provider domains are expected only in backend service/test code.

- [ ] **Step 5: Verify changed files and GitNexus affected scope**

Run:

```bash
git diff --name-only main...HEAD
git status --short --branch
```

Run GitNexus `detect_changes` with `scope: compare` and `base_ref: main`. Confirm affected scope is limited to the payment-method API, admin page, Finance route/navigation, i18n, and tests. Confirm `backend/app/Filament/Pages/Payment.php` and existing checkout service files are absent from the diff.

- [ ] **Step 6: Request code review**

Invoke the `requesting-code-review` skill. Give the reviewer the spec, this plan, the commit range `main...HEAD`, security invariants, and verification outputs. Resolve only findings that trace directly to Phase 4.

- [ ] **Step 7: Commit any review-driven fixes selectively**

If review or verification required fixes, stage only the exact Phase 4 files, rerun focused tests and staged GitNexus `detect_changes`, then commit:

```bash
git commit -m "fix(admin): harden payment methods management"
```

If no fix is required, do not create an empty commit.

- [ ] **Step 8: Final completion check**

Invoke `verification-before-completion`. Report exact test/build commands and results, list Phase 4 commits, confirm zero credential exposure assertions passed, and confirm all pre-existing dirty files remain untouched and uncommitted.
