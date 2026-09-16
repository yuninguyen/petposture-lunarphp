# Phase 4 Admin Finance Payment Methods Design

**Date:** 2026-09-16

**Branch:** `feat/admin-finance-payment-methods`

**Status:** Approved design, pending implementation plan

## 1. Objective

Add a React admin Payment Methods page and matching Laravel admin API for Stripe, PayPal, Airwallex, and Payoneer without removing or changing the existing Filament Payment page or altering live checkout behavior.

The feature must let core administrators inspect safe configuration state, replace or clear database overrides, and test candidate connection credentials before saving them. It must preserve the project's existing `Setting::get(...) ?: config(...)` fallback semantics and enforce zero credential exposure in every API response and React render.

## 2. Scope

### Included

- Four React-visible gateways: Stripe, PayPal, Airwallex, and Payoneer.
- Laravel admin endpoints to list, update, and test gateway configuration.
- Data-driven gateway and field definitions.
- Safe configuration/source metadata with no secret material.
- Candidate credential testing through Laravel.
- Explicit removal of database overrides.
- Raw checkout-service cache invalidation after updates.
- React route, Finance navigation item, bilingual copy, and tests.
- Backend feature tests, provider HTTP fake coverage, and checkout cache regression coverage.

### Excluded

- Removing, replacing, or modifying the Filament Payment page.
- Exposing PingPong in React.
- Altering Stripe, PayPal, Airwallex, Payoneer, or PingPong checkout behavior.
- Persisting connection-test history or last-test metadata.
- Backend verification tokens or backend enforcement of test-before-save.
- Disabling environment fallback with a sentinel value.
- Calling an unverified Payoneer API endpoint for connection testing.
- Refactoring checkout gateway services unless implementation proves a directly required, narrowly scoped change.

## 3. Existing Behavior That Must Be Preserved

### 3.1 Setting keys

| Gateway | Non-secret settings | Secret settings | Mode |
|---|---|---|---|
| Stripe | `stripe_key` | `stripe_secret`, `stripe_webhook_secret` | `stripe_mode` (`test|live`) |
| PayPal | `paypal_client_id` | `paypal_client_secret`, `paypal_webhook_id` | `paypal_mode` (`sandbox|live`) |
| Airwallex | `airwallex_client_id` | `airwallex_api_key`, `airwallex_webhook_secret` | `airwallex_mode` (`sandbox|live`) |
| Payoneer | `payoneer_merchant_code` | `payoneer_api_key`, `payoneer_api_secret`, `payoneer_webhook_secret` | `payoneer_mode` (`sandbox|live`) |

### 3.2 Fallback semantics

Every gateway continues to resolve configuration using the existing behavior:

```php
Setting::get($key) ?: config($configPath)
```

Removing a database override therefore restores the environment/config fallback when one exists. The feature must not add a sentinel or other mechanism that disables fallback.

### 3.3 Two cache layers

1. `Setting::get()` caches `setting:{key}` forever. `SettingCacheObserver` evicts this cache automatically when a Setting is saved or deleted. New update logic must not duplicate this eviction.
2. Checkout services maintain separate raw-key caches. These are not observer-managed and must be explicitly evicted after a payment-method update.

Raw keys to evict are copied from the existing Filament save behavior:

- Stripe: `stripe_key`, `stripe_secret`, `stripe_webhook_secret`.
- PayPal: `paypal_client_id`, `paypal_client_secret`, `paypal_mode`, `paypal_webhook_id`, `paypal_access_token_sandbox`, `paypal_access_token_live`.
- Airwallex: `airwallex_client_id`, `airwallex_api_key`, `airwallex_webhook_secret`, `airwallex_mode`, `airwallex_access_token_sandbox`, `airwallex_access_token_live`.
- Payoneer: `payoneer_merchant_code`, `payoneer_api_key`, `payoneer_api_secret`, `payoneer_webhook_secret`, `payoneer_mode`.

Both sandbox and live access-token keys are always evicted for PayPal and Airwallex. This safely covers credential-only changes and requests that change mode and credentials together.

## 4. Architecture

Use a thin controller and one focused service.

### 4.1 `PaymentMethodController`

Responsibilities:

- Receive and validate HTTP requests.
- Restrict gateway route parameters to the approved four gateways.
- Delegate configuration resolution, update, cache eviction, and connection testing.
- Return controlled JSON and status codes.
- Never echo request payloads or raw provider responses.

### 4.2 `PaymentMethodService`

Responsibilities:

- Own one data-driven registry mapping gateways to field definitions.
- Resolve candidate, database, and environment values.
- Produce safe API representations.
- Apply explicit replacements and clears only for allowlisted fields.
- Evict all required raw checkout caches.
- Run request-scoped connection tests without caching candidates.
- Sanitize all user-facing results.

The registry describes gateway label, mode setting/default/options, non-secret fields, secret fields, test-required fields, config fallback paths, webhook URL, and cache keys. It is a data map, not four strategy classes and not four duplicated CRUD branches.

Provider connection operations use a small gateway `match` because their HTTP authentication contracts genuinely differ. No generic provider interface is introduced for this phase.

### 4.3 Why checkout services are not reused for candidate tests

The existing checkout services resolve credentials internally through `Setting::get()` and their raw caches. They cannot accept an unsaved candidate override and some relevant methods are private. Candidate tests therefore use a separate request-scoped path in `PaymentMethodService`, avoiding all checkout caches and leaving live checkout unaffected until Save succeeds.

## 5. Authorization and Routes

Add the following routes inside the existing `/api/admin` group:

```text
GET  /api/admin/finance/payment-methods
PUT  /api/admin/finance/payment-methods/{gateway}
POST /api/admin/finance/payment-methods/{gateway}/test
```

Allowed gateways:

```text
stripe | paypal | airwallex | payoneer
```

The routes inherit:

- `auth:sanctum`
- Existing role middleware
- `admin.permission`

`EnforceAdminApiPermission` currently allows `super_admin`, `admin`, and `staff` directly and fails closed for unsupported business-role paths. React navigation and routing must use the same core-admin boundary. Customer, Product Manager, Order Manager, and Support users receive `403` for these endpoints.

## 6. Safe Read Contract

`GET /api/admin/finance/payment-methods` returns all four gateways and no last-test metadata.

Example:

```json
{
  "data": [
    {
      "gateway": "stripe",
      "label": "Stripe",
      "configured": true,
      "source": "mixed",
      "mode": "test",
      "webhook_url": "https://api.example.com/api/webhooks/stripe",
      "fields": {
        "stripe_key": {
          "value": "pk_test_example",
          "configured": true,
          "source": "environment"
        },
        "stripe_secret": {
          "configured": true,
          "source": "database",
          "hint": "Configured in database"
        },
        "stripe_webhook_secret": {
          "configured": false,
          "source": "none",
          "hint": "Not configured"
        }
      }
    }
  ]
}
```

### 6.1 Gateway-level configuration

`configured` is based on fields required for provider connection/checkout, not webhook verification fields:

- Stripe: `stripe_secret`.
- PayPal: `paypal_client_id` and `paypal_client_secret`.
- Airwallex: `airwallex_client_id` and `airwallex_api_key`.
- Payoneer: `payoneer_merchant_code`, `payoneer_api_key`, and `payoneer_api_secret`.

### 6.2 Source values

Gateway and field source values use:

```text
database | environment | mixed | none
```

A field is `database` when a non-empty database override is effective, `environment` when config fallback supplies the effective value, and `none` when neither supplies a value.

Gateway source is:

- `database` when all configured fields are database-sourced.
- `environment` when all configured fields are environment-sourced.
- `mixed` when effective configured fields include both database and environment sources.
- `none` when no gateway fields are configured.

### 6.3 Zero credential exposure

Non-secret fields may include their editable `value`.

Secret fields never include:

- A `value` property.
- The real value.
- A masked value.
- Prefix or suffix characters.
- Length or other identifying material.

Secret hints only describe configuration status and source, such as `Configured in database`, `Using environment configuration`, or `Not configured`.

## 7. Update Contract

`PUT /api/admin/finance/payment-methods/{gateway}` accepts explicit replacements and clears.

Example:

```json
{
  "mode": "live",
  "fields": {
    "stripe_key": "pk_live_new",
    "stripe_secret": "sk_live_new"
  },
  "clear_fields": [
    "stripe_webhook_secret"
  ]
}
```

Rules:

- Only fields belonging to the route gateway are accepted.
- Arbitrary Setting keys are rejected.
- An omitted field preserves its current database override/fallback behavior.
- An omitted or empty secret field preserves its current value; an empty string is not a clear operation.
- A replacement requires an explicit non-empty candidate value.
- Mode is validated against the gateway's allowed values and mapped to its exact Setting key.
- `clear_fields` accepts only allowlisted fields belonging to the gateway.
- A field cannot be replaced and cleared in the same request.
- Clear deletes only the Setting database row/override. Environment fallback becomes effective if available.
- Update responses return a freshly resolved safe gateway representation and never echo the request body.
- After any successful update, evict every raw cache key registered for that gateway.

Database writes continue using the existing `payment` Setting group and string type for these values.

## 8. Candidate Connection Test Contract

`POST /api/admin/finance/payment-methods/{gateway}/test` accepts unsaved connection candidates but does not persist them.

Example:

```json
{
  "mode": "live",
  "fields": {
    "stripe_secret": "sk_live_candidate"
  }
}
```

Resolution order for every connection-test input:

1. Non-empty candidate supplied in this request.
2. Current database override.
3. Environment/config fallback.

Candidates are request-scoped, are not cached, and are not written to the database.

The test request excludes webhook secrets/IDs because provider connection tests do not validate webhook credentials.

### 8.1 Stripe

Reuse the existing Filament HTTP contract exactly:

```text
Basic Auth(secret, "")
GET https://api.stripe.com/v1/account
```

### 8.2 PayPal

Reuse the existing Filament HTTP contract exactly:

```text
POST form grant_type=client_credentials
Basic Auth(client_id, client_secret)
Sandbox: https://api-m.sandbox.paypal.com/v1/oauth2/token
Live:    https://api-m.paypal.com/v1/oauth2/token
```

### 8.3 Airwallex

Reuse the existing Filament HTTP contract exactly:

```text
POST /api/v1/authentication/login
Headers: x-client-id, x-api-key
Sandbox: https://api-demo.airwallex.com
Live:    https://api.airwallex.com
```

### 8.4 Payoneer

Do not call Payoneer over HTTP. Preserve the exact existing limitation: check only that merchant code, API key, and API secret are present.

Success uses a distinct status that does not imply connectivity:

```json
{
  "data": {
    "gateway": "payoneer",
    "status": "credentials_present",
    "message": "Required credentials are present. Full Payoneer connectivity is not verified.",
    "mode": "sandbox"
  }
}
```

### 8.5 Result statuses

A successful real provider test returns a controlled result such as:

```json
{
  "data": {
    "gateway": "stripe",
    "status": "connected",
    "message": "Stripe connection verified.",
    "mode": "live"
  }
}
```

- Missing required inputs: `422`.
- Provider credential rejection/non-success response: `422`.
- Timeout or network/transport failure: `502`.
- Success: `200`.

No response contains the provider's raw response body, raw error description, exception message, request candidate, or auth header.

## 9. Logging and Error Safety

The existing API middleware stack does not contain full request-body logging, Sentry, Telescope, or Debugbar. The new test path must preserve that property.

Requirements:

- Do not log the test request payload.
- Do not log candidate credentials, authorization headers, provider raw bodies, or exception context.
- Catch transport/provider exceptions at the feature boundary and return only controlled generic messages.
- Do not pass provider exception messages into JSON responses, toasts, activity records, or application logs.
- Do not enable query logging or error-reporting request-body capture for this endpoint.
- Tests use unique sentinel secrets and assert those strings do not appear in responses or captured logs.

## 10. React UI

### 10.1 Route and navigation

Add:

```text
/finance/payment-methods
```

Add **Payment Methods / Phương thức thanh toán** under Finance immediately after Goals. The route and navigation item are available only to core administrators (`super_admin`, `admin`, `staff`).

### 10.2 Feature structure

Expected focused structure:

```text
admin/src/features/payment-methods/
├── api.ts
├── PaymentMethodsPage.tsx
├── GatewayForm.tsx
├── SecretCredentialInput.tsx
└── feature tests
```

`GatewayForm` and `SecretCredentialInput` are feature-local boundaries for sensitive state and testability. No generic cross-application form framework is introduced.

### 10.3 Page layout

The page displays only:

1. Stripe
2. PayPal
3. Airwallex
4. Payoneer

It must not display PingPong.

Use gateway tabs or an equivalent responsive selector. Each gateway view contains:

- Configured/unconfigured badge.
- Source badge: Database, Environment, Mixed, or Not configured.
- Mode selector.
- Editable non-secret inputs.
- Blank secret candidate inputs.
- Read-only webhook URL and copy action.
- Test Connection action; Payoneer may use Check Credentials if clearer.
- Save Changes action.
- Current request-scoped test result and Payoneer limitation messaging.

### 10.4 Secret credential input

Secret inputs:

- Always initialize as an empty string, including after refresh.
- Never receive old credential values from the API.
- May reveal only the candidate currently typed by the administrator.
- Show source/status metadata separately from the input value.
- Use wording such as `Leave blank to keep the current value`.
- Never use fake bullets to represent stored credentials.
- Never place candidates in URLs, local storage, session storage, React Query cache, toasts, or status text.
- Clear candidate state after a successful Save, when switching gateway, and on unmount.

### 10.5 Remove database override

Only a field whose current source is `database` shows the remove-override action.

Confirmation must clearly state:

> Remove database override — this field will fall back to environment configuration if available. This does not remove or disable the environment value.

Behavior:

- Confirmation adds the field to `clear_fields`.
- Marking a field for clear removes any replacement candidate for that field.
- Typing a new candidate removes the field from `clear_fields`.
- Clear-only changes do not require a connection test.
- Save sends `clear_fields` explicitly; blank inputs never imply clear.

## 11. Test-Before-Save UX Enforcement

Test-before-save is an intentional UI safety gate against accidental admin mistakes. It is not a backend security boundary, and the backend does not issue verification tokens.

### 11.1 Fields that invalidate a connection test

A test is required when changing an input that the provider test actually checks:

- Stripe: mode and secret key.
- PayPal: mode, client ID, and client secret.
- Airwallex: mode, client ID, and API key.
- Payoneer: mode, merchant code, API key, and API secret.

Webhook secret/webhook ID changes do not require or invalidate a connection test because provider auth tests do not validate them. `clear_fields` uses its own explicit confirmation gate and does not require testing.

### 11.2 Independent state axes

Do not implement one linear enum for all form states. Use independent state values, including:

- Whether any field has changed.
- A connection-change revision counter.
- The last successfully tested revision.
- Test request pending state.
- Save request pending state.
- Replacement candidates.
- `clearFields`.
- The latest test result held only in component state.

Representative condition:

```ts
const hasUntestedConnectionChanges =
  connectionRevision > 0 &&
  testedRevision !== connectionRevision;

const canSave =
  hasAnyChanges &&
  !hasUntestedConnectionChanges &&
  !isTesting &&
  !isSaving;
```

Rules:

- Webhook-only or clear-only changes can be saved immediately.
- Changing mode or a connection field increments `connectionRevision` and locks Save.
- A successful test records the current revision and unlocks Save.
- A failed test keeps Save locked.
- A later connection change increments the revision and invalidates the previous test.
- A later webhook-only change does not invalidate a successful connection test.
- Combined connection and webhook changes remain locked until the connection candidate passes; both sets of changes can then be saved together.
- Save success refetches safe state and clears all secret candidates.
- Save failure keeps candidate state available for correction without exposing it in output.

## 12. React API Behavior

The browser calls only the Laravel admin API. It never contacts Stripe, PayPal, Airwallex, or Payoneer directly.

The test request sends:

- Current selected mode.
- Non-empty connection candidate fields.
- No empty secret fields.
- No webhook credential fields.

The Save request sends only explicit changes and `clear_fields`. Omitted secrets remain omitted.

## 13. Internationalization

Add complete EN and VI strings for:

- Navigation and page title/subtitle.
- Gateway and mode labels.
- Configured/unconfigured and source badges.
- Secret source/status hints.
- Test, save, copy, and clear actions.
- Remove-override confirmation.
- Validation, invalid credential, timeout/network, success, and save errors.
- Payoneer's credentials-present-only limitation.

## 14. Testing Strategy

### 14.1 Backend contract tests

Cover:

- Unauthenticated requests return `401`.
- Customer and non-core admin business roles return `403`.
- `super_admin`, `admin`, and `staff` can access the endpoints.
- Only the four approved gateway slugs are accepted.
- GET returns correct mode, webhook URL, configured state, field source, and gateway source.
- Database, environment, mixed, and none source states.
- Secret values never appear as real text, masked text, prefix/suffix, or a `value` property.
- Non-secret values are returned for editing.
- Omitted update fields preserve existing settings.
- Empty secret input does not delete or replace a setting.
- Explicit replacement updates the exact Setting key.
- `clear_fields` removes only the database override and restores environment fallback.
- Arbitrary keys are rejected.
- A field cannot be both replaced and cleared.
- PUT responses do not echo secret material.
- Unauthorized requests do not modify Settings.
- Every registered raw checkout cache key is evicted, including both PayPal/Airwallex token modes and all five Payoneer keys.

### 14.2 Provider tests using `Http::fake()`

Cover:

- Correct host for each mode.
- Correct Stripe Basic Auth.
- Correct PayPal Basic Auth and form body.
- Correct Airwallex auth headers.
- Candidate override precedence over database and environment.
- Omitted candidate fallback to database, then environment.
- Success response.
- Provider rejection as `422`.
- Timeout/network exception as `502`.
- No candidate or provider secret in response or captured logs.
- Payoneer sends no HTTP request and returns `credentials_present` only after required fields are present.

### 14.3 Checkout cache regression

After an update, verify checkout discovery/service resolution observes the new effective configuration rather than a stale five-minute raw-key cache. This test protects the end-to-end boundary between admin updates and live checkout configuration.

### 14.4 React tests

Cover:

- Four gateways render and PingPong does not.
- Route and Finance navigation are core-admin only.
- Secret inputs are blank despite configured metadata.
- Secret material is absent from rendered text/HTML and API fixtures.
- Non-secret inputs are prefilled.
- Blank secret values are omitted from Save payloads.
- Explicit candidate replacements are sent.
- Webhook-only and clear-only changes can Save without testing.
- Mode/connection changes lock Save.
- Successful test unlocks Save.
- Failed test leaves Save locked.
- Connection change after success relocks Save.
- Webhook-only change after success does not invalidate the test.
- Combined connection and webhook changes follow independent state axes.
- Remove override requires the approved confirmation wording and sends `clear_fields`.
- Secret candidates reset after Save and gateway switch.
- Browser requests target only Laravel API paths and never provider domains.
- Payoneer limitation is explicit.
- EN/VI keys and Finance navigation expectations are updated.

## 15. Success Criteria

The phase is complete when:

- Core admins can safely inspect and manage all four approved gateways from React.
- No API response, React render, log, snapshot, cache, or toast exposes stored credential material.
- Candidate connection credentials can be tested without persistence.
- Stripe, PayPal, and Airwallex use the exact established provider test contracts.
- Payoneer performs presence-check only and never claims verified connectivity.
- Accidental UI saves of untested connection changes are blocked.
- Webhook-only and clear-only updates remain possible without a meaningless test.
- Database override removal clearly restores environment fallback semantics.
- All checkout service caches are invalidated correctly after update.
- Existing checkout discovery reads updated effective configuration.
- Filament and all current payment checkout behavior remain intact.
