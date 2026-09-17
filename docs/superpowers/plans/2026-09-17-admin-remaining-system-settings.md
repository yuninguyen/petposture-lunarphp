# Phase 5B Part 2 — Remaining System Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure admin APIs and a bilingual React `/system/settings` page for General, Branding, Analytics, SMTP, and AI settings without changing Filament or the public `/api/settings` contract.

**Architecture:** Two thin controllers delegate to two data-driven services: `AdminSettingsService` handles non-secret General/Branding/Analytics data and media path compatibility; `SecureSettingsService` handles SMTP/AI metadata, updates, candidate resolution, clear semantics, SMTP tests, and OpenAI model fetching. React uses one five-tab page with domain-local queries/forms, request-scoped secret candidates, and revision-based save gates for SMTP and OpenAI.

**Tech Stack:** PHP 8.3, Laravel 11, PHPUnit 12, Sanctum, Spatie roles/permissions, Laravel HTTP client, Symfony Mailer, React 18, TypeScript, Vite, TanStack Query 5, React Testing Library, Vitest 4, i18next.

**Spec:** `docs/superpowers/specs/2026-09-17-admin-remaining-system-settings-design.md`

## Global Constraints

- Work on branch `feat/admin-remaining-system-settings` from `main`.
- Do not modify `backend/app/Filament/Pages/ManageSettings.php`.
- Do not modify `backend/app/Filament/Resources/SettingResource.php`.
- Do not change the public `GET /api/settings` route, controller, response shape, or field names.
- Do not add currency, social, or business-contact editors.
- Do not create a generic JSON settings editor.
- Persist selected media as `CuratorMedia->path`, never absolute URL or raw media ID.
- Widen `MediaPicker` media ID type to `string | null`; never use an empty-string sentinel.
- SMTP and AI secret GET responses expose only `configured`, `source`, and safe `hint` metadata.
- Secret candidates remain request-scoped and must never enter responses, logs, URLs, browser storage, TanStack Query cache, Settings during tests, or Laravel cache.
- Secure update semantics are omission/empty = preserve and explicit `clear_fields` = delete database override.
- SMTP test and OpenAI fetch use candidate → clear-aware DB skip → DB → environment resolution.
- SMTP test email recipient is always the authenticated admin's email.
- SMTP Save is gated by a current successful test for all six SMTP fields, including clear operations.
- AI Save is gated only for `openai_api_key`, `openai_base_url`, and `openai_model`, including clear operations.
- Keep `ai_seo_provider` values exactly `auto|anthropic|openai|grok|gemini`.
- Browser code never calls SMTP or OpenAI directly.
- All new user-facing copy is localized in English and Vietnamese.
- Before every existing-symbol edit, run GitNexus upstream impact; stop and warn on HIGH/CRITICAL.
- Before every commit, run GitNexus `detect_changes` on the staged diff and stage only the exact task files.
- Preserve all pre-existing dirty and untracked files; never use `git add -A` or `git add .`.

## File and Responsibility Map

### Backend files to create

- `backend/app/Services/Admin/AdminSettingsService.php` — General/Branding/Analytics registries, media path resolution, CRUD response formatting.
- `backend/app/Services/Admin/SecureSettingsService.php` — SMTP/AI registries, safe metadata, candidate resolution, updates, SMTP sending, OpenAI model fetching.
- `backend/app/Http/Controllers/Api/Admin/AdminSettingsController.php` — thin non-secret settings controller.
- `backend/app/Http/Controllers/Api/Admin/SecureSettingsController.php` — thin secure settings controller.
- `backend/app/Http/Requests/Admin/UpdateGeneralSettingsRequest.php`
- `backend/app/Http/Requests/Admin/UpdateBrandingSettingsRequest.php`
- `backend/app/Http/Requests/Admin/UpdateAnalyticsSettingsRequest.php`
- `backend/app/Http/Requests/Admin/UpdateSmtpSettingsRequest.php`
- `backend/app/Http/Requests/Admin/TestSmtpSettingsRequest.php`
- `backend/app/Http/Requests/Admin/UpdateAiSettingsRequest.php`
- `backend/app/Http/Requests/Admin/FetchAiModelsRequest.php`
- `backend/tests/Feature/Api/Admin/SettingsTest.php` — all new admin settings API, zero-exposure, candidate resolution, side-effect, and authorization coverage.

### Backend files to modify

- `backend/routes/api.php` — add the eleven admin routes under the existing protected `/admin` group.
- `backend/tests/Feature/SettingsApiTest.php` — add public response-structure lock if the existing assertions do not cover all fields.

### Frontend files to create

- `admin/src/features/settings/api.ts` — exact domain types and GET/PUT/test/fetch wrappers.
- `admin/src/features/settings/SecretSettingInput.tsx` — settings-specific candidate-only secret input with safe hint, clear, and undo.
- `admin/src/features/settings/GeneralSettingsForm.tsx`
- `admin/src/features/settings/BrandingSettingsForm.tsx`
- `admin/src/features/settings/AnalyticsSettingsForm.tsx`
- `admin/src/features/settings/SmtpSettingsForm.tsx`
- `admin/src/features/settings/AiSettingsForm.tsx`
- `admin/src/features/settings/SettingsPage.tsx` — five-tab shell only.
- `admin/src/features/settings/api.test.ts`
- `admin/src/features/settings/SecretSettingInput.test.tsx`
- `admin/src/features/settings/NonSecretSettingsForms.test.tsx`
- `admin/src/features/settings/SmtpSettingsForm.test.tsx`
- `admin/src/features/settings/AiSettingsForm.test.tsx`
- `admin/src/features/settings/SettingsPage.test.tsx`

### Frontend files to modify

- `admin/src/features/media/MediaPicker.tsx` — widen value/onChange media ID from `string` to `string | null`.
- `admin/src/App.tsx` — lazy route `/system/settings` under the existing core-admin route block.
- `admin/src/App.test.ts` — route authorization and fail-closed coverage.
- `admin/src/navigation/adminNavigation.tsx` — append Settings after Activity Logs.
- `admin/src/navigation/adminNavigation.test.tsx` — System order and core-admin visibility.
- `admin/src/locales/en.json` — complete settings namespaces.
- `admin/src/locales/vi.json` — complete settings namespaces.

---

### Task 1: Non-secret settings API and public contract lock

**Files:**
- Create: `backend/app/Services/Admin/AdminSettingsService.php`
- Create: `backend/app/Http/Controllers/Api/Admin/AdminSettingsController.php`
- Create: `backend/app/Http/Requests/Admin/UpdateGeneralSettingsRequest.php`
- Create: `backend/app/Http/Requests/Admin/UpdateBrandingSettingsRequest.php`
- Create: `backend/app/Http/Requests/Admin/UpdateAnalyticsSettingsRequest.php`
- Create: `backend/tests/Feature/Api/Admin/SettingsTest.php`
- Modify: `backend/routes/api.php`
- Modify: `backend/tests/Feature/SettingsApiTest.php`

**Interfaces:**
- Produces `AdminSettingsService::general(): array`, `branding(): array`, `analytics(): array`.
- Produces `updateGeneral(array $payload): array`, `updateBranding(array $payload): array`, `updateAnalytics(array $payload): array`.
- Media GET values are `array{id: string|null, url: string}|null`.
- Media PUT values are `array{media_id: string}|null`.
- Later React tasks consume response envelopes shaped as `{data: DomainState}`.

- [ ] **Step 1: Run impact analysis before route and public-contract test edits**

Run:

```bash
npx gitnexus impact SettingsController -r petposture --direction upstream
npx gitnexus impact routes -r petposture --direction upstream
```

Expected: inspect direct callers/processes; do not continue if HIGH/CRITICAL without reporting.

- [ ] **Step 2: Write failing authorization and read-contract tests**

Add tests to `SettingsTest.php` that create users with `super_admin`, `admin`, `staff`, Product Manager, Order Manager, Support, customer, unknown, and no roles. Assert:

```php
$this->actingAs($coreAdmin)->getJson('/api/admin/settings/general')
    ->assertOk()
    ->assertJsonPath('data.shop_name', 'PetPosture');

$this->actingAs($businessRole)->getJson('/api/admin/settings/general')
    ->assertForbidden();
```

Seed settings with `Setting::set()` rather than mass assignment shortcuts. Assert General, Branding, and Analytics return only their allowlisted keys.

- [ ] **Step 3: Write failing media compatibility tests**

Create a real `CuratorMedia` row using its actual fillable database columns from the installed model/migration. Assert:

```php
$this->actingAs($admin)->putJson('/api/admin/settings/general', [
    'shop_logo' => ['media_id' => (string) $media->id],
])->assertOk();

$this->assertSame($media->path, Setting::get('shop_logo'));
```

Also store a legacy path with no matching media row and assert GET returns:

```php
[
    'id' => null,
    'url' => asset('storage/settings/legacy-logo.png'),
]
```

Assert GET does not change `CuratorMedia::count()` and explicit `shop_logo: null` deletes the setting.

- [ ] **Step 4: Write the public API structure regression test**

In `SettingsApiTest.php`, assert the complete existing structural contract:

```php
$this->getJson('/api/settings')
    ->assertOk()
    ->assertJsonStructure(['data' => [
        'shop_name', 'shop_logo', 'shop_favicon', 'admin_logo', 'admin_favicon',
        'description', 'frontend_url',
        'localization' => ['currency', 'symbol'],
        'social' => ['facebook', 'instagram', 'twitter', 'tiktok', 'pinterest', 'youtube'],
        'contact' => ['phone', 'address'],
        'analytics' => ['google_analytics_id'],
    ]]);
```

Do not edit `SettingsController` to make the test pass.

- [ ] **Step 5: Run tests to verify RED**

Run:

```bash
cd backend
php artisan test tests/Feature/Api/Admin/SettingsTest.php tests/Feature/SettingsApiTest.php
```

Expected: new admin endpoint tests fail with 404 or missing classes; existing public tests remain green.

- [ ] **Step 6: Implement request validation**

Use explicit rules:

```php
// UpdateGeneralSettingsRequest
return [
    'shop_name' => ['sometimes', 'string', 'max:255'],
    'shop_description' => ['sometimes', 'nullable', 'string', 'max:5000'],
    'shop_logo' => ['sometimes', 'nullable', 'array:media_id'],
    'shop_logo.media_id' => ['required_with:shop_logo', 'string', 'exists:curator_media,id'],
    'shop_favicon' => ['sometimes', 'nullable', 'array:media_id'],
    'shop_favicon.media_id' => ['required_with:shop_favicon', 'string', 'exists:curator_media,id'],
];
```

Branding repeats the media rules for `admin_logo` and `admin_favicon`. Analytics accepts only nullable bounded `google_analytics_id`.

- [ ] **Step 7: Implement `AdminSettingsService`**

Use constants for domain field registries and setting groups. Required public signatures:

```php
public function general(): array;
public function updateGeneral(array $payload): array;
public function branding(): array;
public function updateBranding(array $payload): array;
public function analytics(): array;
public function updateAnalytics(array $payload): array;
```

For text values:

```php
if ($value === null) {
    Setting::where('key', $key)->first()?->delete();
} else {
    Setting::set($key, $value, 'string', $group);
}
```

For media replacement:

```php
$media = CuratorMedia::findOrFail($payload[$key]['media_id']);
Setting::set($key, $media->path, 'string', $group);
```

For media GET, match `CuratorMedia::where('path', $stored)->first()` and return string ID when found, otherwise a `null` ID with the resolved asset URL. Preserve absolute URLs defensively when resolving legacy values.

- [ ] **Step 8: Implement thin controller and routes**

Controller methods:

```php
public function general(AdminSettingsService $settings): JsonResponse;
public function updateGeneral(UpdateGeneralSettingsRequest $request, AdminSettingsService $settings): JsonResponse;
public function branding(AdminSettingsService $settings): JsonResponse;
public function updateBranding(UpdateBrandingSettingsRequest $request, AdminSettingsService $settings): JsonResponse;
public function analytics(AdminSettingsService $settings): JsonResponse;
public function updateAnalytics(UpdateAnalyticsSettingsRequest $request, AdminSettingsService $settings): JsonResponse;
```

Each returns `response()->json(['data' => ...])`. Add six explicit routes under the existing protected admin group.

- [ ] **Step 9: Run focused and compatibility tests**

Run:

```bash
cd backend
php artisan test tests/Feature/Api/Admin/SettingsTest.php tests/Feature/SettingsApiTest.php tests/Feature/StorefrontAssetParityTest.php
```

Expected: PASS; public `/api/settings` remains unauthenticated and structurally unchanged.

- [ ] **Step 10: Format, detect staged impact, and commit**

Run Pint on exact new/modified PHP files. Stage only Task 1 files, run GitNexus staged `detect_changes`, then commit:

```bash
git commit -m "feat(admin): add non-secret system settings API"
```

---

### Task 2: Secure SMTP/AI metadata and update semantics

**Files:**
- Create: `backend/app/Services/Admin/SecureSettingsService.php`
- Create: `backend/app/Http/Controllers/Api/Admin/SecureSettingsController.php`
- Create: `backend/app/Http/Requests/Admin/UpdateSmtpSettingsRequest.php`
- Create: `backend/app/Http/Requests/Admin/UpdateAiSettingsRequest.php`
- Modify: `backend/routes/api.php`
- Modify: `backend/tests/Feature/Api/Admin/SettingsTest.php`

**Interfaces:**
- Produces `smtp(): array`, `updateSmtp(array): array`, `ai(): array`, `updateAi(array): array`.
- Produces registries queried by request classes: `smtpFieldNames(): array`, `aiFieldNames(): array`, `aiProviderValues(): array`.
- Secret field state is `array{configured: bool, source: string, hint: string}` with no `value` member.
- Non-secret field state is `array{value: mixed, configured: bool, source: string, hint: string}`.

- [ ] **Step 1: Run impact analysis on Payment Method reference symbols and routes**

Run:

```bash
npx gitnexus impact PaymentMethodService -r petposture --direction upstream
npx gitnexus impact Setting -r petposture --direction upstream
```

Read `PaymentMethodService` but do not modify it.

- [ ] **Step 2: Write failing zero-exposure GET tests**

Seed database and config secret sentinels for SMTP and all four AI providers. Assert GET responses contain source/configured/hint but never contain any sentinel, mask, length, prefix, or suffix:

```php
$response->assertJsonMissingPath('data.fields.smtp_pass.value');
$this->assertStringNotContainsString($smtpSecret, $response->getContent());
$this->assertStringNotContainsString($openAiSecret, $response->getContent());
```

Assert database/environment/mixed/none aggregate source behavior.

- [ ] **Step 3: Write failing update semantics tests**

Cover:

- Omitted secret preserves DB value.
- Empty secret candidate preserves DB value.
- Non-empty candidate replaces DB value.
- `clear_fields` deletes DB override and exposes environment metadata.
- Replacement plus clear conflict returns `422`.
- Arbitrary and cross-domain keys return `422`.
- Responses never contain secret sentinels.

Use exact AI provider enum including `grok`.

- [ ] **Step 4: Run tests to verify RED**

Run:

```bash
cd backend
php artisan test --filter='SettingsTest'
```

Expected: secure endpoint tests fail with 404/missing classes.

- [ ] **Step 5: Implement secure registries and metadata**

Define registries equivalent to:

```php
private const SMTP_FIELDS = [
    'smtp_host' => ['secret' => false, 'config' => 'mail.mailers.smtp.host', 'type' => 'string'],
    'smtp_port' => ['secret' => false, 'config' => 'mail.mailers.smtp.port', 'type' => 'int'],
    'smtp_user' => ['secret' => false, 'config' => 'mail.mailers.smtp.username', 'type' => 'string'],
    'smtp_pass' => ['secret' => true, 'config' => 'mail.mailers.smtp.password', 'type' => 'string'],
    'smtp_encryption' => ['secret' => false, 'config' => 'mail.mailers.smtp.scheme', 'type' => 'string'],
    'mail_from_address' => ['secret' => false, 'config' => 'mail.from.address', 'type' => 'string'],
];
```

Define all ten AI fields with the verified `services.*` paths. Implement truthiness-compatible DB→config resolution, `sourceFor`, safe hints, aggregate source, and a formatter that omits `value` for secrets.

- [ ] **Step 6: Implement secure update logic**

Required signatures:

```php
public function smtp(): array;
public function updateSmtp(array $payload): array;
public function ai(): array;
public function updateAi(array $payload): array;
public function smtpFieldNames(): array;
public function aiFieldNames(): array;
public function aiProviderValues(): array;
```

Use `fields` and `clear_fields` payload sections. Ignore empty string replacements. Delete clears first, then write non-empty replacements with the registry type/group. Return refreshed safe metadata.

- [ ] **Step 7: Implement FormRequests**

`UpdateSmtpSettingsRequest` rules:

```php
'fields' => ['sometimes', 'array:smtp_host,smtp_port,smtp_user,smtp_pass,smtp_encryption,mail_from_address'],
'fields.smtp_host' => ['sometimes', 'nullable', 'string', 'max:255'],
'fields.smtp_port' => ['sometimes', 'nullable', 'integer', 'between:1,65535'],
'fields.smtp_user' => ['sometimes', 'nullable', 'string', 'max:255'],
'fields.smtp_pass' => ['sometimes', 'nullable', 'string', 'max:4096'],
'fields.smtp_encryption' => ['sometimes', 'nullable', Rule::in(['tls', 'ssl', 'none'])],
'fields.mail_from_address' => ['sometimes', 'nullable', 'email:rfc', 'max:255'],
'clear_fields' => ['sometimes', 'array'],
'clear_fields.*' => ['string', 'distinct', Rule::in($service->smtpFieldNames())],
```

AI request validates all ten allowlisted fields, provider enum, HTTP(S) base URL, and clear conflicts. Reuse an `after()` conflict check pattern matching `UpdatePaymentMethodRequest`.

- [ ] **Step 8: Add controller methods and routes**

Add GET/PUT SMTP and GET/PUT AI methods returning safe data envelopes. Register four explicit routes.

- [ ] **Step 9: Run tests, Pint, PHPStan, detect, and commit**

Run:

```bash
cd backend
php artisan test --filter=SettingsTest
vendor/bin/pint --test app/Services/Admin/SecureSettingsService.php app/Http/Controllers/Api/Admin/SecureSettingsController.php app/Http/Requests/Admin/UpdateSmtpSettingsRequest.php app/Http/Requests/Admin/UpdateAiSettingsRequest.php tests/Feature/Api/Admin/SettingsTest.php
vendor/bin/phpstan analyse --no-progress app/Services/Admin/SecureSettingsService.php app/Http/Controllers/Api/Admin/SecureSettingsController.php app/Http/Requests/Admin/UpdateSmtpSettingsRequest.php app/Http/Requests/Admin/UpdateAiSettingsRequest.php
```

Stage exact Task 2 files, run staged `detect_changes`, commit:

```bash
git commit -m "feat(admin): manage secure system settings safely"
```

---

### Task 3: SMTP candidate test endpoint

**Files:**
- Create: `backend/app/Http/Requests/Admin/TestSmtpSettingsRequest.php`
- Modify: `backend/app/Services/Admin/SecureSettingsService.php`
- Modify: `backend/app/Http/Controllers/Api/Admin/SecureSettingsController.php`
- Modify: `backend/routes/api.php`
- Modify: `backend/tests/Feature/Api/Admin/SettingsTest.php`

**Interfaces:**
- Produces `SecureSettingsService::testSmtp(array $payload, string $recipient): array{status_code:int,data:array}`.
- Produces protected seam `sendSmtpTest(array $configuration, string $recipient): void` for a test subclass to capture effective values without a real SMTP server.
- Request payload is `{fields?: Partial<SmtpFields>, clear_fields?: string[]}`.

- [ ] **Step 1: Run impact analysis**

Run:

```bash
npx gitnexus impact sendTestEmail -r petposture --direction upstream
npx gitnexus impact SecureSettingsService -r petposture --direction upstream
```

Read the Filament SMTP implementation as behavior reference only; do not edit it.

- [ ] **Step 2: Write failing resolution and recipient tests**

Use a test-only subclass bound into the container:

```php
$service = new class extends SecureSettingsService {
    public array $sent = [];
    protected function sendSmtpTest(array $configuration, string $recipient): void
    {
        $this->sent = compact('configuration', 'recipient');
    }
};
$this->app->instance(SecureSettingsService::class, $service);
```

Assert candidate overrides DB, DB overrides config, and `clear_fields` skips DB. Assert recipient equals `$admin->email` even if an arbitrary recipient key is posted. Assert candidates are absent from Settings, Cache, response JSON, and captured logs.

- [ ] **Step 3: Write failing sanitized failure tests**

Make the test subclass throw a transport exception containing a secret sentinel. Assert response is sanitized `502` and logs/responses omit the sentinel. Cover missing effective host/from-address as sanitized `422`.

- [ ] **Step 4: Run RED test**

Run:

```bash
cd backend
php artisan test --filter='smtp'
```

Expected: route or `testSmtp` missing.

- [ ] **Step 5: Implement request validation and clear-aware resolution**

`TestSmtpSettingsRequest` accepts the same `fields` validation as update plus allowlisted `clear_fields`. It does not accept a recipient.

Add a reusable resolver:

```php
private function resolveCandidateField(string $field, array $payload, array $definition): mixed
```

Resolution order is non-empty candidate, clear-aware DB skip, DB override, config fallback. Normalize port to integer and encryption to `tls|ssl|none`.

- [ ] **Step 6: Implement SMTP sending and safe mapping**

`testSmtp()` validates effective required values, calls `sendSmtpTest()`, and returns safe data such as:

```php
['status_code' => 200, 'data' => ['status' => 'sent', 'message' => 'SMTP test email sent.']]
```

`sendSmtpTest()` builds `EsmtpTransport`, maps TLS mode exactly, applies username/password only when username is present, builds `Email`, and sends it with `Symfony\Component\Mailer\Mailer`.

Catch validation/provider rejection separately from transport/unexpected errors without returning raw exception text or logging payloads.

- [ ] **Step 7: Add controller route**

Controller passes only `$request->validated()` and `(string) $request->user()->email` to the service. Return the service status code and safe data.

- [ ] **Step 8: Verify and commit**

Run SMTP-filtered tests, all `SettingsTest`, Pint, focused PHPStan. Stage exact files, run `detect_changes`, commit:

```bash
git commit -m "feat(admin): test SMTP settings before save"
```

---

### Task 4: OpenAI model fetch endpoint

**Files:**
- Create: `backend/app/Http/Requests/Admin/FetchAiModelsRequest.php`
- Modify: `backend/app/Services/Admin/SecureSettingsService.php`
- Modify: `backend/app/Http/Controllers/Api/Admin/SecureSettingsController.php`
- Modify: `backend/routes/api.php`
- Modify: `backend/tests/Feature/Api/Admin/SettingsTest.php`

**Interfaces:**
- Produces `fetchOpenAiModels(array $payload): array{status_code:int,data:array{status:string,models:list<string>}}`.
- Request accepts `fields.openai_api_key`, `fields.openai_base_url`, `fields.openai_model`, and matching `clear_fields`.

- [ ] **Step 1: Run impact analysis**

Run:

```bash
npx gitnexus impact fetchOpenAiModels -r petposture --direction upstream
npx gitnexus impact SecureSettingsService -r petposture --direction upstream
```

- [ ] **Step 2: Write failing HTTP contract tests**

Use `Http::preventStrayRequests()` and `Http::fake()` to assert:

```php
$this->assertSame('Bearer candidate-key', $request->header('Authorization')[0]);
$this->assertSame('https://proxy.example/v1/models', $request->url());
```

Return duplicate/empty/unsorted IDs and assert response models are non-empty, unique, and sorted.

Cover candidate → DB → config and clear-aware fallback for key and base URL.

- [ ] **Step 3: Write failing security and error tests**

Assert missing key and provider rejection return sanitized `422`; connection exception returns sanitized `502`; provider error bodies and key sentinels never appear in response/logs/cache/Settings.

- [ ] **Step 4: Run RED test**

Run:

```bash
cd backend
php artisan test --filter='open_ai|fetch_models'
```

Expected: route/method missing.

- [ ] **Step 5: Implement request and service method**

Use a strict `array:openai_api_key,openai_base_url,openai_model` field allowlist and clear conflicts.

Call:

```php
Http::withToken($apiKey)
    ->timeout(15)
    ->get(rtrim($baseUrl ?: 'https://api.openai.com/v1', '/').'/models');
```

Extract `data.*.id`, filter strings/non-empty, unique, sort, and return values. Never return provider error bodies.

- [ ] **Step 6: Add controller route and verify**

Register `POST /admin/settings/ai/fetch-models`. Run all `SettingsTest`, Pint, focused PHPStan.

- [ ] **Step 7: Detect and commit**

Stage exact Task 4 files, run `detect_changes`, commit:

```bash
git commit -m "feat(admin): fetch OpenAI models safely"
```

---

### Task 5: Frontend API contract and reusable secure input

**Files:**
- Create: `admin/src/features/settings/api.ts`
- Create: `admin/src/features/settings/api.test.ts`
- Create: `admin/src/features/settings/SecretSettingInput.tsx`
- Create: `admin/src/features/settings/SecretSettingInput.test.tsx`
- Modify: `admin/src/features/media/MediaPicker.tsx`

**Interfaces:**
- Produces types `SettingSource`, `SafeSecretField`, `ValueField<T>`, domain states, update/test payloads, and API wrappers.
- Produces `SecretSettingInput` with blank candidate, safe metadata, clear, undo, and candidate-only reveal.
- `MediaPicker` consumes/produces `{id: string|null, url:string}|null`.

- [ ] **Step 1: Run impact analysis before MediaPicker type edit**

Run:

```bash
npx gitnexus impact MediaPicker -r petposture --direction upstream
```

Review all direct TypeScript callers. The widened nullable ID must remain assignable to current usage.

- [ ] **Step 2: Write failing API wrapper tests**

Mock `fetchJson` and assert exact endpoints/methods and plain object bodies:

```ts
expect(fetchJson).toHaveBeenCalledWith('/admin/settings/smtp/test', {
  method: 'POST',
  body: payload,
});
```

Cover all eleven endpoints. Assert no wrapper calls provider domains.

- [ ] **Step 3: Define exact API types**

Use narrow public interfaces without `extends Record<string, unknown>`:

```ts
export type SettingSource = 'database' | 'environment' | 'mixed' | 'none';
export interface SafeSecretField { configured: boolean; source: SettingSource; hint: string; }
export interface ValueField<T = string | null> extends SafeSecretField { value: T; }
export interface MediaSettingValue { id: string | null; url: string; }
```

Define payloads with `fields` and `clear_fields`; internally spread payloads when passing to `fetchJson`.

- [ ] **Step 4: Write failing secure input tests**

Assert configured secrets hydrate blank, candidate reveal affects only typed candidate, no bullets/masks/secret-derived text appears, database source has clear/undo, and exact fallback warning is localized.

- [ ] **Step 5: Run RED tests**

Run:

```bash
cd admin
npx vitest run src/features/settings/api.test.ts src/features/settings/SecretSettingInput.test.tsx
```

Expected: missing modules.

- [ ] **Step 6: Implement wrappers and `SecretSettingInput`**

Follow the behavioral contract of Payment Methods without importing payment-specific types or translation keys. Use settings localization keys. Keep reveal state local and reset naturally on remount.

- [ ] **Step 7: Widen MediaPicker ID type**

Change only its prop types:

```ts
value: { id: string | null; url: string } | null;
onChange: (media: { id: string | null; url: string } | null) => void;
```

Do not change MediaLibraryModal selection behavior; it still returns real string IDs.

- [ ] **Step 8: Verify, detect, and commit**

Run focused tests and `npx tsc --noEmit`. Stage exact Task 5 files, run `detect_changes`, commit:

```bash
git commit -m "feat(admin): add settings client security primitives"
```

---

### Task 6: General, Branding, and Analytics React forms

**Files:**
- Create: `admin/src/features/settings/GeneralSettingsForm.tsx`
- Create: `admin/src/features/settings/BrandingSettingsForm.tsx`
- Create: `admin/src/features/settings/AnalyticsSettingsForm.tsx`
- Create: `admin/src/features/settings/NonSecretSettingsForms.test.tsx`

**Interfaces:**
- Each form fetches its own state and updates its own query key.
- Query keys are `['admin','settings','general']`, `['admin','settings','branding']`, and `['admin','settings','analytics']`.
- Media fields pass `context="general"` and submit `{media_id}` or explicit `null`.

- [ ] **Step 1: Write failing form tests**

Mock API wrappers. Assert:

- General renders name, description, logo, favicon.
- Branding renders admin logo/favicon.
- Analytics renders GA ID.
- All MediaPickers receive `context="general"`.
- Legacy `{id:null,url}` renders preview.
- New selection saves `{media_id: '123'}`.
- Remove saves explicit `null`.
- Omitted unchanged text fields are not added to payload.
- Successful save replaces query data with returned state.

- [ ] **Step 2: Run RED tests**

Run:

```bash
cd admin
npx vitest run src/features/settings/NonSecretSettingsForms.test.tsx
```

Expected: missing form modules.

- [ ] **Step 3: Implement forms minimally**

Each form owns local editable state initialized from its query result and one `useMutation`. Build minimal update payloads by comparing current values to server state. Do not store form candidates in QueryClient until the server returns refreshed safe data.

Use existing shared `Input`, `Button`, and `MediaPicker` components. Use localized labels only.

- [ ] **Step 4: Verify and commit**

Run focused tests and TypeScript. Stage exact files, run `detect_changes`, commit:

```bash
git commit -m "feat(admin): add general branding analytics forms"
```

---

### Task 7: SMTP form with clear-aware test-before-save gate

**Files:**
- Create: `admin/src/features/settings/SmtpSettingsForm.tsx`
- Create: `admin/src/features/settings/SmtpSettingsForm.test.tsx`

**Interfaces:**
- Consumes SMTP API wrappers and `SecretSettingInput`.
- Maintains independent `connectionRevision` and `testedRevision`.
- Sends candidates and `clear_fields` directly to test/save mutations.

- [ ] **Step 1: Write failing initial and payload tests**

Assert:

- `smtp_pass` input is blank on hydration.
- Effective non-secret values prefill.
- Save starts disabled with no changes.
- Empty password is omitted.
- Clear and replacement are mutually exclusive.
- Save payload contains only changed fields and explicit clears.

- [ ] **Step 2: Write failing gate tests**

Cover every connection field through parameterized tests. Assert any change disables Save until current test succeeds. Assert failed test does not authorize, post-success edit revokes, reverting removes obsolete test requirement only when no effective change remains, and clear requires test with `clear_fields`.

Assert test recipient explanation is localized and no recipient input exists.

- [ ] **Step 3: Write candidate-leak regression**

Type a secret sentinel, test and save through mocks, and assert it is absent from:

- QueryClient data
- `localStorage`
- `sessionStorage`
- `window.location.href`
- rendered status/error text

- [ ] **Step 4: Run RED test**

Run:

```bash
cd admin
npx vitest run src/features/settings/SmtpSettingsForm.test.tsx
```

Expected: missing form module.

- [ ] **Step 5: Implement current-effective-change revision logic**

Compute whether connection testing is required from current effective differences, not historical event count. Increment `connectionRevision` on connection mutations; authorize only captured successful revision. Clear/undo/revert must reconcile against current fields and clear set.

Map `422` to controlled localized rejection and `502`/other to controlled unavailable text. Never render `caught.message`.

- [ ] **Step 6: Reset safely after save**

On successful save, replace query data with server response, blank secret candidates, clear clear-fields/test state, and rebuild local non-secret state from response.

- [ ] **Step 7: Verify, detect, and commit**

Run focused tests and TypeScript. Stage exact files, run `detect_changes`, commit:

```bash
git commit -m "feat(admin): gate SMTP settings with test email"
```

---

### Task 8: AI form with OpenAI-only model-fetch gate

**Files:**
- Create: `admin/src/features/settings/AiSettingsForm.tsx`
- Create: `admin/src/features/settings/AiSettingsForm.test.tsx`

**Interfaces:**
- Consumes AI API wrappers and `SecretSettingInput`.
- Gates only `openai_api_key`, `openai_base_url`, and `openai_model`.
- Stores fetched model IDs in request-local component state, not QueryClient.

- [ ] **Step 1: Write failing ten-field rendering and hydration tests**

Assert all ten fields exist, four secrets start blank, provider enum uses `grok`, and safe metadata hints render without masks.

- [ ] **Step 2: Write failing gate classification tests**

Assert changes to OpenAI key/base URL/model require successful fetch before Save. Assert changes to provider, Anthropic, xAI, or Gemini fields do not require fetch.

Assert clear of OpenAI fields sends `clear_fields` to fetch and must be re-fetched. Undo/revert removes obsolete authorization requirements according to current effective changes.

- [ ] **Step 3: Write failing model membership tests**

Mock models `['gpt-a','gpt-b']`. Assert a non-empty selected effective model must be present before Save is authorized. Selecting a returned model authorizes the captured revision; changing model revokes it.

- [ ] **Step 4: Write security tests**

Assert API-key candidates are absent from QueryClient, storage, URL, DOM error text, and model options. Assert raw provider error sentinel is replaced with localized `422` or unavailable copy.

- [ ] **Step 5: Run RED test**

Run:

```bash
cd admin
npx vitest run src/features/settings/AiSettingsForm.test.tsx
```

Expected: missing form module.

- [ ] **Step 6: Implement form and revision gate**

Keep all secret candidates local. Fetch models directly with candidates/clear intent. Store only returned model IDs locally. Gate Save only when the current effective OpenAI change set is non-empty and not authorized by the current tested revision.

Non-OpenAI changes remain saveable without model fetch.

- [ ] **Step 7: Verify, detect, and commit**

Run focused tests and TypeScript. Stage exact files, run `detect_changes`, commit:

```bash
git commit -m "feat(admin): manage AI provider settings safely"
```

---

### Task 9: Settings page, route, navigation, and bilingual copy

**Files:**
- Create: `admin/src/features/settings/SettingsPage.tsx`
- Create: `admin/src/features/settings/SettingsPage.test.tsx`
- Modify: `admin/src/App.tsx`
- Modify: `admin/src/App.test.ts`
- Modify: `admin/src/navigation/adminNavigation.tsx`
- Modify: `admin/src/navigation/adminNavigation.test.tsx`
- Modify: `admin/src/locales/en.json`
- Modify: `admin/src/locales/vi.json`

**Interfaces:**
- Produces lazy route `/system/settings`.
- Produces five tabs in fixed order: General, Branding, Analytics, SMTP, AI.
- Adds System nav item after Activity Logs using the existing core-admin predicate.

- [ ] **Step 1: Run impact analysis before route/navigation edits**

Run:

```bash
npx gitnexus impact AppRoutes -r petposture --direction upstream
npx gitnexus impact ADMIN_NAV_GROUPS -r petposture --direction upstream
```

- [ ] **Step 2: Write failing tab shell tests**

Assert fixed tab order and only the active domain form renders. Switch tabs and verify prior secret candidates are unmounted and not present in DOM or QueryClient.

- [ ] **Step 3: Write failing route and navigation tests**

Assert `/system/settings` renders for `super_admin`, `admin`, and `staff`. Assert Product Manager, Order Manager, Support, customer, unknown, and empty roles fail closed to the existing safe home behavior.

Assert System item paths are exactly:

```ts
['/system/users', '/system/roles', '/system/media', '/system/activity-logs', '/system/settings']
```

- [ ] **Step 4: Add complete EN/VI key assertions**

Build a required-key list covering all five namespaces, field labels, source hints, media help, clear/undo, pending/success/error states, SMTP recipient copy, provider names, model states, and validation messages. Assert both locale objects contain non-empty values for every key.

- [ ] **Step 5: Run RED tests**

Run page, App, and navigation tests. Expected: missing page/route/nav/locale keys.

- [ ] **Step 6: Implement page, route, and nav**

Lazy-import `SettingsPage`, add it inside the existing `isCoreAdmin` block, and append the navigation item after Activity Logs. Use one settings/cog icon consistent with existing inline SVG patterns.

- [ ] **Step 7: Add translations and remove hardcoded copy**

Add complete namespace keys to both locale files. Search new settings components for user-facing English literals and replace them with `t()` calls. Raw field names and machine statuses may remain constants; rendered copy may not.

- [ ] **Step 8: Verify build and commit**

Run focused settings tests, route/navigation tests, `npx tsc --noEmit`, and `npm run build`. Stage exact files, run `detect_changes`, commit:

```bash
git commit -m "feat(admin): add remaining system settings page"
```

---

### Task 10: Full security, compatibility, and regression verification

**Files:**
- Modify only Phase 5B files if a verified defect is found.
- Create scratch report: `.superpowers/sdd/2026-09-17-admin-remaining-system-settings/task-10-report.md`

**Interfaces:**
- Consumes all prior tasks.
- Produces verification evidence and a whole-branch review verdict.

- [ ] **Step 1: Run required backend verification**

Run and preserve full output:

```bash
cd backend
php artisan test --filter=SettingsTest
php artisan test tests/Feature/SettingsApiTest.php tests/Feature/StorefrontAssetParityTest.php
```

Expected: all pass; `/api/settings` remains public and structurally unchanged.

- [ ] **Step 2: Run backend format/static checks**

Run Pint `--test` and focused PHPStan on all new controllers, services, requests, routes, and `SettingsTest`. Do not fix unrelated repository-wide failures.

- [ ] **Step 3: Run required frontend verification**

Run and preserve full output:

```bash
cd admin
npx vitest run src/features/settings/
npx tsc --noEmit
```

Then run route/navigation focused tests and `npm run build`.

- [ ] **Step 4: Run explicit leak scans**

Use harness grep to confirm:

- No masks such as `********` in `admin/src/features/settings`.
- No provider domains in browser settings code.
- No `request()->all`, `Log::`, or `logger(` in the two new services/controllers.
- No candidate names in cache/storage/toast code paths.
- Provider domains occur only in backend service/tests.

- [ ] **Step 5: Verify protected-file scope**

Run:

```bash
git diff --name-only main...HEAD
git status --short --branch
```

Confirm the branch does not modify:

- `backend/app/Filament/Pages/ManageSettings.php`
- `backend/app/Filament/Resources/SettingResource.php`
- `backend/app/Http/Controllers/Api/SettingsController.php`
- Existing payment/checkout source files

Run GitNexus branch `detect_changes` against `main` and inspect any HIGH/CRITICAL report against the exact diff before proceeding.

- [ ] **Step 6: Request whole-branch review**

Dispatch the strongest available reviewer with the spec, plan, `main...HEAD` diff, security invariants, verification evidence, and deferred minor findings. Require explicit Critical/Important/Minor findings and merge readiness.

- [ ] **Step 7: Apply at most one complete fix wave**

If the reviewer reports Critical or Important findings, send the complete finding list to one fresh fixer, rerun scoped tests/static checks, selectively commit:

```bash
git commit -m "fix(admin): harden remaining system settings"
```

Then run one scoped re-review. Do not create an empty commit.

- [ ] **Step 8: Final evidence and branch handoff**

Invoke `verification-before-completion`, record exact commands/results and zero-exposure evidence, then invoke `finishing-a-development-branch` and present merge/PR/keep options. Confirm pre-existing dirty and untracked files remain untouched.
