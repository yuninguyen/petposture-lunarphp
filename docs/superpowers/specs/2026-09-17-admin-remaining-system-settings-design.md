# Phase 5B Part 2 — Remaining System Settings Design

## Purpose

Migrate the remaining settings managed by `backend/app/Filament/Pages/ManageSettings.php` into the React admin while preserving Filament during stabilization.

The new feature adds dedicated admin APIs and one React settings page for five domains:

1. General
2. Admin Branding
3. Analytics
4. SMTP
5. AI Settings

This work must not change the public `GET /api/settings` contract, `SettingResource.php`, existing SEO/social settings APIs, currency settings, Filament pages/resources, or live consumers of existing setting values.

## Scope

### Included settings

#### General

- `shop_name`
- `shop_logo`
- `shop_favicon`
- `shop_description`

#### Admin Branding

- `admin_logo`
- `admin_favicon`

#### Analytics

- `google_analytics_id`

#### SMTP

- `smtp_host`
- `smtp_port`
- `smtp_user`
- `smtp_pass` — secret
- `smtp_encryption`
- `mail_from_address`

#### AI Settings

- `ai_seo_provider`
- `anthropic_api_key` — secret
- `anthropic_model`
- `openai_api_key` — secret
- `openai_model`
- `openai_base_url`
- `xai_api_key` — secret
- `xai_model`
- `gemini_api_key` — secret
- `gemini_model`

`ai_seo_provider_status` is computed display state in Filament, not a persisted setting, and is outside the setting key count.

### Explicitly excluded

- Any modification to `backend/app/Filament/Pages/ManageSettings.php`
- Any modification to `backend/app/Filament/Resources/SettingResource.php`
- Removal or hiding of Filament settings UI
- Changes to public `GET /api/settings` response shape or field names
- Social and business contact settings already managed by `SeoSocialController`
- `default_currency` and `currency_symbol`
- Generic JSON setting editing
- New media folders or a new upload component
- Browser-side SMTP or OpenAI requests
- Test endpoints for Anthropic, xAI, or Gemini

## Architectural Approach

Use two thin controllers and two data-driven services.

### Non-secret settings boundary

`AdminSettingsController` delegates to `AdminSettingsService` for:

- General
- Branding
- Analytics

The service owns allowlists, value normalization, media resolution, setting groups, and response formatting.

### Secure settings boundary

`SecureSettingsController` delegates to `SecureSettingsService` for:

- SMTP read/update/test
- AI read/update/OpenAI model fetch

The service owns field registries, zero-exposure metadata, candidate resolution, clear semantics, source reporting, provider calls, SMTP construction, sanitized result mapping, and cache-safe responses.

Controllers only authorize through route middleware, invoke validated requests/services, and return HTTP responses.

No per-domain strategy hierarchy is required. A small data-driven registry is preferred over duplicated controller logic or a generic settings framework.

## Admin API

All routes are registered under the existing `/api/admin` group with the same core-admin protection used by Finance Payment Methods:

- `auth:sanctum`
- role restriction to `super_admin|admin|staff`
- `admin.permission`

Routes:

```text
GET  /api/admin/settings/general
PUT  /api/admin/settings/general
GET  /api/admin/settings/branding
PUT  /api/admin/settings/branding
GET  /api/admin/settings/analytics
PUT  /api/admin/settings/analytics
GET  /api/admin/settings/smtp
PUT  /api/admin/settings/smtp
POST /api/admin/settings/smtp/test
GET  /api/admin/settings/ai
PUT  /api/admin/settings/ai
POST /api/admin/settings/ai/fetch-models
```

Unknown domains or unsupported fields must fail closed rather than reaching generic setting mutation.

## Public API Compatibility Lock

The existing public route remains unchanged:

```text
GET /api/settings
```

It remains unauthenticated and continues to be served by `App\Http\Controllers\Api\SettingsController::index`.

The response shape and field names must remain byte-for-byte compatible at the structural level, including:

- `shop_name`
- `shop_logo`
- `shop_favicon`
- `admin_logo`
- `admin_favicon`
- `description`
- `frontend_url`
- `localization.currency`
- `localization.symbol`
- `social.*`
- `contact.phone`
- `contact.address`
- `analytics.google_analytics_id`

The new admin endpoints add write/read management without changing this public controller or route.

Existing compatibility tests, especially `StorefrontAssetParityTest`, must remain green.

## Group A — Non-secret Settings

### Response model

General, Branding, and Analytics GET endpoints return real values because these domains contain no credentials.

A successful PUT returns the refreshed domain state.

Omitted fields remain unchanged. Text fields may use explicit `null` to remove a database setting. Empty-string handling is field-specific validation, but it must not accidentally clear a value through omission semantics.

### Setting groups

Persist settings with the existing groups:

- General fields: `general`
- Admin Branding fields: `admin`
- Analytics field: `general`

### Media values

React uses the existing `MediaPicker` with:

```tsx
context="general"
```

The frontend form state uses:

```ts
{ id: string | null; url: string } | null
```

`MediaPicker` must widen its value/onChange media ID type from `string` to `string | null` so it represents legacy previews truthfully. This is a compatible type-level extension: newly selected media from `MediaLibraryModal` still always carries a real string ID, while legacy previews may carry `null`. Empty-string IDs must not be used as a sentinel.

#### GET behavior

For each image setting:

1. Read the persisted path/value.
2. Resolve the safe public URL using the same URL/path rules as the existing public settings API.
3. If a `CuratorMedia` record matches the stored path, return its string ID and URL.
4. If the stored path is a legacy Filament upload without a matching media record, return:

```json
{
  "id": null,
  "url": "https://example.test/storage/settings/logo.png"
}
```

5. If no value exists, return `null`.

GET must not create or mutate `CuratorMedia` records.

#### PUT behavior

When selecting a new image, the browser sends a `media_id`, not a URL or raw path.

The backend must:

1. Validate the ID exists in `curator_media`.
2. Resolve `CuratorMedia::findOrFail($mediaId)->path`.
3. Persist that relative storage path in `Setting`.

The backend must never persist the absolute media URL or the raw media ID.

Explicit `null` removes the image setting. Legacy previews remain unchanged unless the administrator selects a replacement or removes them.

This format is required for simultaneous compatibility with:

- Filament `FileUpload`
- `AdminPanelProvider`, which assumes relative storage paths
- Public `SettingsController::resolveAssetUrl()`

## Group B — Zero-Credential-Exposure Rules

SMTP and AI secret fields follow the verified Payment Methods security pattern.

### Forbidden exposure

No secret response may contain:

- The secret value
- A mask derived from its length
- Prefixes or suffixes
- Secret length
- Candidate values
- Provider-returned text that may contain a candidate

Candidates must not enter:

- GET/PUT/test responses
- Application logs
- URLs
- Browser storage
- TanStack Query cache
- Toasts or rendered raw errors
- `Setting` during test actions
- Laravel cache

### Secret metadata

Secret GET fields contain only safe metadata:

```json
{
  "configured": true,
  "source": "database",
  "hint": "Configured in database"
}
```

Allowed sources are:

```text
database | environment | mixed | none
```

Individual fields normally report `database`, `environment`, or `none`. A domain-level aggregate may report `mixed` when its effective fields come from multiple sources.

### Update semantics

For secret and non-secret secure fields:

- Omitted value: preserve current database override.
- Empty candidate string: preserve current database override.
- Non-empty candidate: replace the database override.
- `clear_fields`: explicitly delete the database override.
- A field cannot appear in both replacements and `clear_fields`.
- Clearing a database override does not remove or disable the environment fallback.

The UI warning must communicate that distinction explicitly.

## Candidate Resolution

Test actions resolve every participating field in this order:

```text
non-empty request candidate
→ if field is in clear_fields, skip database
→ database override
→ config/environment fallback
→ field-specific default, where documented
```

Candidates and clear intent are request-scoped and are never persisted by test actions.

Resolution truthiness must match the existing runtime consumers. Database values that would be treated as absent by the live service must fall back identically in admin metadata and tests.

## SMTP Domain

### Config fallbacks

```text
smtp_host         → mail.mailers.smtp.host
smtp_port         → mail.mailers.smtp.port
smtp_user         → mail.mailers.smtp.username
smtp_pass         → mail.mailers.smtp.password
smtp_encryption   → mail.mailers.smtp.scheme
mail_from_address → mail.from.address
```

`smtp_encryption` accepts the existing values:

```text
tls | ssl | none
```

### GET

`smtp_pass` is always blank in the browser and represented only by safe metadata.

Non-secret SMTP fields return effective values and sources. Domain metadata reports whether required connection values are configured and the aggregate source.

### PUT

PUT applies the secure update semantics and returns refreshed safe metadata.

No password appears in the response.

### Test email endpoint

`POST /api/admin/settings/smtp/test` accepts request-scoped candidates and `clear_fields`.

It resolves the effective post-save configuration and builds `Symfony\Component\Mailer\Transport\Smtp\EsmtpTransport` server-side.

Encryption mapping preserves current behavior:

```text
ssl  → implicit TLS (`true`)
tls  → STARTTLS negotiation (`null`)
none → plaintext (`false`)
```

The endpoint sends the test email only to the authenticated admin user's email address. It does not accept a recipient from the browser.

Success returns a safe status/message without credentials or recipient-sensitive detail beyond the authenticated user's expected destination.

Failure mapping:

- Missing/invalid effective inputs or SMTP rejection: sanitized `422`
- Transport, timeout, or unexpected connectivity failure: sanitized `502`

Raw exception messages must not be returned or logged with candidates.

### SMTP test-before-save gate

All six SMTP fields are connection-relevant:

- `smtp_host`
- `smtp_port`
- `smtp_user`
- `smtp_pass`
- `smtp_encryption`
- `mail_from_address`

The React form maintains independent `connectionRevision` and `testedRevision` values.

Save is allowed only when:

- There is a change, and
- The current effective connection change set has a successful test for its current revision, and
- No test/save request is pending.

Changing, reverting, replacing, clearing, or undoing a field must reconcile the gate against the current effective change set rather than historical edits.

Clear operations require retesting. The test endpoint receives `clear_fields`, skips the database override for those fields, and verifies the environment fallback that would become effective after Save.

## AI Domain

### Provider enum

`ai_seo_provider` accepts exactly:

```text
auto | anthropic | openai | grok | gemini
```

The persisted value `grok` must remain compatible with `AiSeoGeneratorService`.

### Config fallbacks

```text
anthropic_api_key → services.anthropic.key
anthropic_model   → services.anthropic.model
openai_api_key    → services.openai.key
openai_model      → services.openai.model
openai_base_url   → services.openai.base_url
xai_api_key       → services.xai.key
xai_model         → services.xai.model
gemini_api_key    → services.gemini.key
gemini_model      → services.gemini.model
```

### GET and PUT

All four API keys use secret metadata only.

Non-secret provider/model/base URL fields return effective values and sources.

PUT uses the secure omission, replacement, and explicit-clear rules.

### Fetch OpenAI models endpoint

`POST /api/admin/settings/ai/fetch-models` accepts request-scoped values for:

- `openai_api_key`
- `openai_base_url`
- `openai_model`
- `clear_fields`

Resolution uses candidate → clear-aware DB skip → DB → config/environment.

If no base URL is configured, use:

```text
https://api.openai.com/v1
```

The server calls:

```text
GET {rtrim(baseUrl, '/')}/models
Authorization: Bearer <resolved API key>
Timeout: 15 seconds
```

A successful response returns sorted, unique, non-empty model IDs only.

It must not return:

- The resolved API key
- Provider error bodies
- Raw exception text
- Arbitrary response metadata

Failure mapping:

- Missing required API key, provider rejection, invalid/empty model list: sanitized `422`
- Transport, timeout, or unexpected connectivity failure: sanitized `502`

### AI test-before-save gate

Only OpenAI fields have an existing test mechanism and participate in the gate:

- `openai_api_key`
- `openai_base_url`
- `openai_model`

A current successful model fetch authorizes Save for the current OpenAI revision.

Changing or clearing any of these fields invalidates authorization. Clear operations are tested against the environment fallback that would become effective after Save.

If the effective `openai_model` is non-empty, it must appear in the returned model list before the revision is authorized.

These fields are not gated because no test mechanism exists for them:

- `ai_seo_provider`
- `anthropic_api_key`
- `anthropic_model`
- `xai_api_key`
- `xai_model`
- `gemini_api_key`
- `gemini_model`

They still use safe candidate and clear semantics.

## React Admin

### Route and page

Add one lazy-loaded route:

```text
/system/settings
```

The page contains five tabs in this order:

1. General
2. Branding
3. Analytics
4. SMTP
5. AI

The System navigation order becomes:

1. Users
2. Roles
3. Media
4. Activity Logs
5. Settings

Both route and navigation use the existing core-admin predicate for:

- `super_admin`
- `admin`
- `staff`

All other, unknown, or empty role sets fail closed and redirect to the existing safe home route.

### Query and form isolation

Each domain has its own query key and mutation boundary.

Query cache contains only server-returned safe metadata and non-secret values. Secret candidates remain component-local and are passed directly to mutation functions.

Switching tabs must not cache, persist, or display candidate secrets. A successful save replaces the domain query data with the refreshed safe response and resets candidate, clear, and test state.

### Group A forms

General, Branding, and Analytics use straightforward controlled forms.

All image fields use the existing `MediaPicker` with `context="general"`. No new upload component or media folder is introduced.

Legacy image values with `id: null` remain previewable. A new selected media item sends its ID. Removing an image sends explicit `null`.

### Group B forms

SMTP and AI reuse the behavioral pattern established by `SecretCredentialInput`:

- Initially blank candidate
- Safe configured/source hint
- Candidate-only reveal
- Explicit remove database override
- Clear warning
- Undo removal
- No stored credential mask

Shared behavior may be extracted carefully, but Payment Methods security and save-gating behavior must not regress.

SMTP exposes **Send test email**. AI exposes **Fetch OpenAI models** and uses the request-scoped returned list for the OpenAI model selection UI.

Raw API/provider/transport messages are never rendered. UI maps known statuses to controlled localized text.

## Localization

Add complete English and Vietnamese copy under:

- `settings_general.*`
- `settings_branding.*`
- `settings_analytics.*`
- `settings_smtp.*`
- `settings_ai.*`

Coverage includes:

- Navigation and tabs
- Field labels and help text
- Media actions and legacy preview context
- Configured/source hints
- Clear warning and undo action
- Test/fetch/save labels and pending states
- SMTP authenticated-recipient explanation
- Model loading/empty states
- Sanitized validation/rejection/unavailable messages
- Save success/failure messages

No user-facing copy is hardcoded in the new settings components.

## Validation

Requests use explicit allowlists and reject arbitrary or cross-domain fields.

Representative constraints:

- `shop_name`: required string within a bounded length
- Descriptions: nullable bounded string
- Media IDs: nullable, integer/string-compatible ID, exists in `curator_media`
- `google_analytics_id`: nullable bounded string
- SMTP port: integer in valid TCP port range
- SMTP encryption: `tls|ssl|none`
- Email: valid email address
- AI provider: `auto|anthropic|openai|grok|gemini`
- Base URL: valid HTTP(S) URL
- `clear_fields`: array of allowlisted domain fields
- Replacement and clear conflict: rejected

Empty secret candidates preserve existing values.

## Cache and Runtime Compatibility

`SettingCacheObserver` continues to own invalidation of `setting:*` cache entries when settings are saved or deleted.

The new services use `Setting::set()` or model deletion so observer invalidation remains authoritative.

No test action writes Settings or cache entries.

Effective resolution mirrors current live consumers and existing config paths. The implementation must not change `AiSeoGeneratorService`, mail runtime configuration, public SettingsController, AdminPanelProvider, Filament settings code, or existing asset URL semantics.

## Security and Error Handling

- Never call SMTP or OpenAI from the browser.
- Never log request payloads or raw exceptions in secure settings flows.
- Never use `request()->all()`.
- Never include candidate values in URLs.
- Never store candidates in TanStack Query, localStorage, sessionStorage, toasts, or Laravel cache.
- Sanitize all provider and transport errors.
- Authorization is enforced on every admin route.
- Unsupported keys fail closed.
- Test email recipient is fixed to the authenticated admin.

## Testing Strategy

### Backend

Add focused `SettingsTest` coverage for:

- Authentication and core-admin role matrix for every route family
- General/Branding/Analytics read and update allowlists
- Media ID to `CuratorMedia->path` persistence
- Legacy media preview without GET side effects
- Explicit image removal
- Public `GET /api/settings` shape and field-name compatibility
- Existing `StorefrontAssetParityTest`
- SMTP and AI secret zero exposure
- Database/environment/mixed/none source metadata
- Omitted and empty secret preservation
- Explicit clear and replacement/clear conflicts
- Candidate → database → environment resolution
- Clear-aware environment fallback during test actions
- SMTP test sent to the authenticated admin only
- SMTP candidate values absent from Settings, cache, responses, and logs
- OpenAI request URL, bearer auth, timeout behavior, sorting, uniqueness, and empty results
- Sanitized `422` and `502` mappings
- Secret sentinel absence from responses and captured logs
- No test action persistence

Tests must respect model `$fillable`, avoid nonexistent factories, avoid seeded-name collisions, and use real existing fixtures where applicable.

### Frontend

Add `admin/src/features/settings/` tests for:

- Five-tab order and selection
- Route and System navigation authorization/order
- General/Branding MediaPicker behavior with `context="general"`
- Legacy media preview and explicit removal
- Secret inputs blank on hydration
- Safe source hints without masks or secret characters
- SMTP six-field revision gate, including clear/retest, revert, undo, failure, and success
- AI OpenAI-only revision gate, including clear/retest and selected model membership
- Ungated Anthropic/xAI/Gemini changes
- Minimal update payloads and explicit `clear_fields`
- Candidate absence from QueryClient, browser storage, URL, DOM error output, and toast/status text
- Controlled localized error mapping
- English/Vietnamese completeness
- Save reset from fresh safe metadata

Use `vi.resetAllMocks()` where tests depend on multiple `mockResolvedValueOnce` sequences. Wrap post-click async assertions with `await waitFor(...)`. Pass plain objects to `fetchJson`; it handles JSON serialization.

## Required Verification

Before completion, run and report full output for:

```text
cd backend && php artisan test --filter=SettingsTest
cd admin && npx vitest run src/features/settings/
cd admin && npx tsc --noEmit
```

Also run the existing public settings compatibility coverage, including `StorefrontAssetParityTest`, and explicitly confirm:

- `GET /api/settings` remains public.
- Its response structure and field names are unchanged.
- Filament files are unchanged.
- `SettingResource.php` is unchanged.
- No protected checkout/payment behavior is modified.
