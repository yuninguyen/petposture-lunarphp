# AI SEO Multi-Provider and Contrast Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add resilient, configurable multi-provider AI SEO generation and correct all audited orange text contrast failures on light backgrounds without changing public API contracts or the brand palette.

**Architecture:** `AiSeoGeneratorService` remains the prompt builder and public facade, but resolves four isolated `AiSeoProvider` adapters and retries configured candidates in preference order. Providers normalize their own structured response through one shared five-field validator. Filament owns system-level key/model/preference inputs; the frontend only replaces audited text-color usages with existing rust tokens.

**Tech Stack:** Laravel 11 / PHP 8.3, Anthropic PHP SDK, Laravel HTTP client, Filament 3, PHPUnit 12 + Mockery, Next.js 16.2, React 19, Tailwind 4, TypeScript 5.

**Spec:** `docs/superpowers/specs/2026-09-01-ai-seo-accessibility-design.md`

## Global Constraints

- Preserve `AiSeoGeneratorService::generate(string $title, ?string $content, string $contentType = 'blog'): array` and the exact successful five-field JSON response of `POST /api/admin/posts/generate-seo`.
- Preserve the existing API validation and HTTP 422 `{ "message": "..." }` failure shape; never expose raw vendor errors, keys, prompts, or response bodies.
- Provider preference is system-level only: `auto|anthropic|openai|grok|gemini`; an explicit provider is attempted first and remaining configured providers are fallback candidates.
- A new OpenAI/xAI/Gemini provider is configured only with a non-empty key and model. Do not hard-code a “latest” model identifier.
- Anthropic alone falls back to `claude-sonnet-5` only when its Setting and `ANTHROPIC_MODEL` are both blank.
- Read provider Setting values before environment configuration and rely on `Setting::get()` cache invalidation; do not add a second AI-key TTL cache.
- Do not add Composer dependencies for OpenAI, xAI, or Gemini.
- Do not alter `C.secondary`, `secondaryText`, orange backgrounds/borders/dots/gradients, dark-surface orange text, icons outside the text remediation, or the unused HomePage ghost button variant.
- All provider tests use mocks/faked HTTP responses; no test calls a vendor API. Do not deploy or run production PageSpeed.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `backend/app/Contracts/AiSeoProvider.php` | Create | Defines provider selection and generation contract. |
| `backend/app/Exceptions/AiSeoGenerationException.php` | Create | Holds safe, user-facing generation failures. |
| `backend/app/Services/AiSeoProviders/AiSeoMetadata.php` | Create | Owns canonical five-field JSON schema and strict response normalization. |
| `backend/app/Services/AiSeoProviders/AbstractAiSeoProvider.php` | Create | Centralizes DB-over-config key/model lookup and safe metadata decoding. |
| `backend/app/Services/AiSeoProviders/AnthropicSeoProvider.php` | Create | Preserves Anthropic SDK request behavior, with configurable model fallback. |
| `backend/app/Services/AiSeoProviders/OpenAiSeoProvider.php` | Create | Sends OpenAI structured chat request and extracts JSON. |
| `backend/app/Services/AiSeoProviders/GrokSeoProvider.php` | Create | Sends xAI OpenAI-compatible structured chat request and extracts JSON. |
| `backend/app/Services/AiSeoProviders/GeminiSeoProvider.php` | Create | Sends Gemini REST structured-generation request and extracts JSON. |
| `backend/app/Services/AiSeoGeneratorService.php` | Modify | Builds the existing prompt, orders adapters, logs safe diagnostics, and falls back. |
| `backend/config/services.php` | Modify | Adds API-key/model environment mappings for all providers. |
| `backend/.env.example` | Modify | Documents all AI provider key and model variables. |
| `backend/app/Filament/Pages/ManageSettings.php` | Modify | Adds the AI Settings tab, masked secrets, model/preference inputs, and provider status. |
| `backend/tests/Feature/Services/AiSeoGeneratorServiceTest.php` | Create | Covers resolver priority, fallback, configuration, and safe final failures with mocks. |
| `backend/tests/Feature/Services/AiSeoProvidersTest.php` | Create | Covers fake HTTP/SDK response parsing and strict five-field output normalization. |
| `backend/tests/Feature/Filament/ManageSettingsTest.php` | Create | Verifies that the AI Settings form persists preference/model values and never hydrates stored key text. |
| `backend/tests/Feature/Api/Admin/AiSeoControllerTest.php` | Modify only if needed | Keeps controller auth, validation, exact JSON, and safe 422 message contract covered. |
| `frontend/components/HomePage.tsx` | Modify | Replaces audited inline light-surface text colors with `C.rust`. |
| `frontend/app/dogs/[slug]/page.tsx` | Modify | Uses `text-rust` for Read Guide on white cards. |
| `frontend/app/solutions/[slug]/page.tsx` | Modify | Uses `text-rust` for Read Guide on white cards. |
| `frontend/components/BlogPostPage.tsx` | Modify | Uses `text-rust` for light-surface drop-cap and Read Story. |
| `frontend/components/ContactPage.tsx` | Modify | Uses `text-rust` for contact labels. |
| `frontend/components/shop/ProductCard.tsx` | Modify | Uses `text-rust` for default Add to Cart text. |
| `frontend/components/FaqsPage.tsx` | Modify | Uses `hover:text-rust` on the light category navigation. |
| `frontend/components/LegalPageLayout.tsx` | Modify | Uses `hover:text-rust` on the light section navigation. |

### Task 1: Define the provider contract and canonical metadata result

**Files:**
- Create: `backend/app/Contracts/AiSeoProvider.php`
- Create: `backend/app/Exceptions/AiSeoGenerationException.php`
- Create: `backend/app/Services/AiSeoProviders/AiSeoMetadata.php`
- Test: `backend/tests/Feature/Services/AiSeoProvidersTest.php`

**Interfaces:**
- Produces `AiSeoProvider::name(): string`, `AiSeoProvider::isConfigured(): bool`, and `AiSeoProvider::generate(string $prompt): array`.
- Produces `AiSeoMetadata::schema(): array`, `AiSeoMetadata::normalize(mixed $value): array`, and `AiSeoGenerationException` with safe messages.
- Consumed by all provider adapters and `AiSeoGeneratorService`.

- [ ] **Step 1: Write the failing metadata-normalization tests**

```php
public function test_normalize_returns_the_exact_five_string_fields(): void
{
    $metadata = AiSeoMetadata::normalize([
        'seo_title' => 'Dog Ramp Guide',
        'focus_keyphrase' => 'dog ramp',
        'meta_description' => 'A grounded dog ramp guide.',
        'social_title' => 'Choose a dog ramp',
        'social_description' => 'Practical dog-ramp fit advice.',
        'unexpected' => 'discarded',
    ]);

    $this->assertSame([
        'seo_title' => 'Dog Ramp Guide',
        'focus_keyphrase' => 'dog ramp',
        'meta_description' => 'A grounded dog ramp guide.',
        'social_title' => 'Choose a dog ramp',
        'social_description' => 'Practical dog-ramp fit advice.',
    ], $metadata);
}

public function test_normalize_rejects_missing_or_non_string_required_fields(): void
{
    $this->expectException(AiSeoGenerationException::class);
    AiSeoMetadata::normalize(['seo_title' => 'Only one field']);
}
```

- [ ] **Step 2: Run the new test file and verify it fails because the classes do not exist**

Run: `php artisan test tests/Feature/Services/AiSeoProvidersTest.php`

Expected: FAIL with missing `AiSeoMetadata` / `AiSeoGenerationException` classes.

- [ ] **Step 3: Create the provider contract, safe exception, and validator**

```php
interface AiSeoProvider
{
    public function name(): string;
    public function isConfigured(): bool;

    /** @return array{seo_title:string,focus_keyphrase:string,meta_description:string,social_title:string,social_description:string} */
    public function generate(string $prompt): array;
}

final class AiSeoMetadata
{
    public const FIELDS = ['seo_title', 'focus_keyphrase', 'meta_description', 'social_title', 'social_description'];

    public static function normalize(mixed $value): array
    {
        if (! is_array($value)) {
            throw new AiSeoGenerationException('AI provider returned an invalid SEO response.');
        }

        $result = [];
        foreach (self::FIELDS as $field) {
            if (! array_key_exists($field, $value) || ! is_string($value[$field])) {
                throw new AiSeoGenerationException('AI provider returned an invalid SEO response.');
            }
            $result[$field] = $value[$field];
        }

        return $result;
    }
}
```

Make `schema()` return the existing object schema, five descriptions, required array, and `additionalProperties => false` so every provider requests the same contract.

- [ ] **Step 4: Re-run the metadata tests**

Run: `php artisan test tests/Feature/Services/AiSeoProvidersTest.php`

Expected: PASS.

- [ ] **Step 5: Run GitNexus change detection before committing the contract**

Run the GitNexus `gitnexus_detect_changes()` MCP tool. Confirm the affected scope is the new provider contract and metadata validation only. If it reports HIGH or CRITICAL risk, stop and report it before committing.

- [ ] **Step 6: Commit the contract unit**

```bash
git add backend/app/Contracts/AiSeoProvider.php backend/app/Exceptions/AiSeoGenerationException.php backend/app/Services/AiSeoProviders/AiSeoMetadata.php backend/tests/Feature/Services/AiSeoProvidersTest.php
git commit -m "feat(ai-seo): add provider contract and metadata schema"
```

### Task 2: Implement configuration-aware provider adapters

**Files:**
- Create: `backend/app/Services/AiSeoProviders/AbstractAiSeoProvider.php`
- Create: `backend/app/Services/AiSeoProviders/AnthropicSeoProvider.php`
- Create: `backend/app/Services/AiSeoProviders/OpenAiSeoProvider.php`
- Create: `backend/app/Services/AiSeoProviders/GrokSeoProvider.php`
- Create: `backend/app/Services/AiSeoProviders/GeminiSeoProvider.php`
- Modify: `backend/config/services.php`
- Modify: `backend/.env.example`
- Test: `backend/tests/Feature/Services/AiSeoProvidersTest.php`

**Interfaces:**
- Consumes `AiSeoProvider`, `AiSeoMetadata`, `AiSeoGenerationException`, `Setting::get()`, and Laravel `Http` fakes.
- Produces four concrete providers whose `isConfigured()` behavior is key-and-model based, except the approved Anthropic fallback.

- [ ] **Step 1: Add failing configuration and fake-transport tests**

```php
public function test_openai_requires_both_key_and_model(): void
{
    config()->set('services.openai.key', 'env-key');
    config()->set('services.openai.model', '');

    $this->assertFalse(app(OpenAiSeoProvider::class)->isConfigured());

    Setting::set('openai_model', 'account-approved-model');
    $this->assertTrue(app(OpenAiSeoProvider::class)->isConfigured());
}

public function test_anthropic_uses_the_approved_sonnet_fallback_when_model_is_blank(): void
{
    config()->set('services.anthropic.key', 'env-key');
    config()->set('services.anthropic.model', '');

    $provider = app(AnthropicSeoProvider::class);
    $this->assertTrue($provider->isConfigured());
    $this->assertSame('claude-sonnet-5', $provider->model());
}

public function test_openai_provider_normalizes_a_fake_structured_response(): void
{
    config()->set('services.openai.key', 'env-key');
    config()->set('services.openai.model', 'account-approved-model');
    Http::fake(['https://api.openai.com/v1/chat/completions' => Http::response([
        'choices' => [['message' => ['content' => json_encode($this->metadata())]]],
    ])]);

    $this->assertSame($this->metadata(), app(OpenAiSeoProvider::class)->generate('Prompt'));
}
```

Add equivalent fake response tests for Grok’s OpenAI-compatible payload and Gemini’s `candidates[0].content.parts[0].text` payload. Add tests where malformed JSON throws `AiSeoGenerationException`.

- [ ] **Step 2: Run provider tests to verify they fail**

Run: `php artisan test tests/Feature/Services/AiSeoProvidersTest.php`

Expected: FAIL because provider classes and `services.*` configuration keys do not exist.

- [ ] **Step 3: Add services configuration and environment documentation**

Add configuration entries with no new model defaults:

```php
'openai' => ['key' => env('OPENAI_API_KEY'), 'model' => env('OPENAI_MODEL')],
'xai' => ['key' => env('XAI_API_KEY'), 'model' => env('XAI_MODEL')],
'gemini' => ['key' => env('GEMINI_API_KEY'), 'model' => env('GEMINI_MODEL')],
'anthropic' => ['key' => env('ANTHROPIC_API_KEY'), 'model' => env('ANTHROPIC_MODEL')],
```

Document `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `XAI_API_KEY`, `XAI_MODEL`, `GEMINI_API_KEY`, and `GEMINI_MODEL` in the AI section of `.env.example`. State that OpenAI/xAI/Gemini model identifiers come from the administrator’s enabled vendor account, while Anthropic has only the approved compatibility fallback.

- [ ] **Step 4: Implement the shared configuration base class**

```php
abstract class AbstractAiSeoProvider implements AiSeoProvider
{
    abstract protected function keySetting(): string;
    abstract protected function keyConfig(): string;
    abstract protected function modelSetting(): string;
    abstract protected function modelConfig(): string;

    protected function key(): string
    {
        return trim((string) (Setting::get($this->keySetting()) ?: config($this->keyConfig(), '')));
    }

    public function model(): string
    {
        return trim((string) (Setting::get($this->modelSetting()) ?: config($this->modelConfig(), '')));
    }

    public function isConfigured(): bool
    {
        return filled($this->key()) && filled($this->model());
    }

    protected function decodeMetadata(string $json): array
    {
        return AiSeoMetadata::normalize(json_decode($json, true));
    }
}
```

Override `AnthropicSeoProvider::model()` to append only `claude-sonnet-5` after both configured sources are blank. Do not log or return raw HTTP response content when conversion fails.

- [ ] **Step 5: Implement provider-specific minimal transports**

Use the existing Anthropic SDK with `AiSeoMetadata::schema()` in `outputConfig.format`. OpenAI posts to `https://api.openai.com/v1/chat/completions`; Grok posts to `https://api.x.ai/v1/chat/completions`. Both use structured chat-completion payloads with `response_format.type = json_schema`, schema name `ai_seo_metadata`, `strict = true`, and `AiSeoMetadata::schema()`, then decode `choices.0.message.content`.

Use Gemini REST `https://generativelanguage.googleapis.com/v1beta/models/{urlencoded-model}:generateContent`, a user text part containing the prompt, and `generationConfig` with `responseMimeType = application/json` and `responseSchema = AiSeoMetadata::schema()`; decode `candidates.0.content.parts.0.text`. Set a bounded request timeout. Every non-success response, empty candidate, malformed JSON, or missing required field throws `AiSeoGenerationException('AI provider returned an invalid SEO response.')` rather than leaking body text.

- [ ] **Step 6: Re-run provider tests**

Run: `php artisan test tests/Feature/Services/AiSeoProvidersTest.php`

Expected: PASS with no outbound network request.

- [ ] **Step 7: Run GitNexus change detection before committing adapters**

Run the GitNexus `gitnexus_detect_changes()` MCP tool. Confirm the affected scope is provider configuration and AI SEO generation. If it reports HIGH or CRITICAL risk, stop and report it before committing.

- [ ] **Step 8: Commit adapter/configuration work**

```bash
git add backend/app/Services/AiSeoProviders backend/config/services.php backend/.env.example backend/tests/Feature/Services/AiSeoProvidersTest.php
git commit -m "feat(ai-seo): add configurable provider adapters"
```

### Task 3: Convert the SEO service into a safe fallback resolver

**Files:**
- Modify: `backend/app/Services/AiSeoGeneratorService.php`
- Create: `backend/tests/Feature/Services/AiSeoGeneratorServiceTest.php`
- Test: `backend/tests/Feature/Api/Admin/AiSeoControllerTest.php`

**Interfaces:**
- Consumes `AnthropicSeoProvider`, `OpenAiSeoProvider`, `GrokSeoProvider`, `GeminiSeoProvider`, `AiSeoProvider`, `AiSeoGenerationException`, and `Setting::get('ai_seo_provider', 'auto')`.
- Produces unchanged `AiSeoGeneratorService::generate()` output, `isConfigured(): bool`, `configuredProviderNames(): array`, and `activeProviderName(): ?string` based on ordered configured providers.

- [ ] **Step 1: Write failing resolver tests with concrete provider mocks**

```php
public function test_auto_uses_anthropic_before_other_configured_providers(): void
{
    $anthropic = Mockery::mock(AnthropicSeoProvider::class);
    $anthropic->shouldReceive('isConfigured')->andReturnTrue();
    $anthropic->shouldReceive('generate')->once()->andReturn($this->metadata());
    $openai = Mockery::mock(OpenAiSeoProvider::class);
    $openai->shouldReceive('isConfigured')->never();
    $this->app->instance(AnthropicSeoProvider::class, $anthropic);
    $this->app->instance(OpenAiSeoProvider::class, $openai);

    $this->assertSame($this->metadata(), app(AiSeoGeneratorService::class)->generate('Title', null));
}

public function test_selected_provider_is_tried_first_then_a_failed_provider_falls_back(): void
{
    Setting::set('ai_seo_provider', 'openai');
    $openai = Mockery::mock(OpenAiSeoProvider::class);
    $openai->shouldReceive('isConfigured')->andReturnTrue();
    $openai->shouldReceive('generate')->once()->andThrow(new AiSeoGenerationException('safe provider failure'));
    $anthropic = Mockery::mock(AnthropicSeoProvider::class);
    $anthropic->shouldReceive('isConfigured')->andReturnTrue();
    $anthropic->shouldReceive('generate')->once()->andReturn($this->metadata());
    $this->app->instance(OpenAiSeoProvider::class, $openai);
    $this->app->instance(AnthropicSeoProvider::class, $anthropic);

    $this->assertSame($this->metadata(), app(AiSeoGeneratorService::class)->generate('Title', null));
}

public function test_no_configured_provider_has_a_safe_configuration_message(): void
{
    $this->expectException(AiSeoGenerationException::class);
    $this->expectExceptionMessage('AI SEO is not configured. Add an API key and model in Settings.');
    app(AiSeoGeneratorService::class)->generate('Title', null);
}
```

Also test all providers fail with the safe temporary-unavailable message, blank/invalid preference behaves as `auto`, database preference overrides configuration default, and `isConfigured()` returns true when any provider mock is configured.

- [ ] **Step 2: Run resolver tests and verify they fail against the single Anthropic service**

Run: `php artisan test tests/Feature/Services/AiSeoGeneratorServiceTest.php`

Expected: FAIL because the resolver does not accept/provider-order adapters yet.

- [ ] **Step 3: Replace single-provider selection with ordered candidates**

Keep the existing prompt construction byte-for-byte unless extracting it to a private method. Add a constructor accepting the four concrete provider types. Build a deterministic provider map and order it as follows:

```php
private function orderedProviders(): array
{
    $providers = [
        'anthropic' => $this->anthropic,
        'openai' => $this->openai,
        'grok' => $this->grok,
        'gemini' => $this->gemini,
    ];
    $preferred = Setting::get('ai_seo_provider', 'auto');

    if (! array_key_exists($preferred, $providers)) {
        return array_values($providers);
    }

    return [$providers[$preferred], ...array_values(array_diff_key($providers, [$preferred => true]))];
}
```

Add `configuredProviders(): array`, which filters `orderedProviders()` by `isConfigured()`, plus public status helpers:

```php
public function isConfigured(): bool
{
    return $this->configuredProviders() !== [];
}

public function configuredProviderNames(): array
{
    return array_map(fn (AiSeoProvider $provider) => $provider->name(), $this->configuredProviders());
}

public function activeProviderName(): ?string
{
    return $this->configuredProviderNames()[0] ?? null;
}
```

For each configured provider, call `generate($prompt)`, return the first valid result, and catch `Throwable`. Log only `provider`, exception class, and a stable failure category. On no candidates throw `AiSeoGenerationException('AI SEO is not configured. Add an API key and model in Settings.')`; after all candidates fail throw `AiSeoGenerationException('AI SEO generation is temporarily unavailable. Please try again later.')`.

- [ ] **Step 4: Preserve the controller contract and prevent raw exception exposure**

Retain `AiSeoController` success behavior and all request validation. Amend its existing exception test to expect the new safe resolver message. Do not alter route URI, method, request keys, or five-field successful response.

- [ ] **Step 5: Run resolver and controller tests**

Run: `php artisan test tests/Feature/Services/AiSeoGeneratorServiceTest.php tests/Feature/Api/Admin/AiSeoControllerTest.php`

Expected: PASS.

- [ ] **Step 6: Run GitNexus change detection before committing the resolver**

Run the GitNexus `gitnexus_detect_changes()` MCP tool. Confirm the affected scope includes only AI SEO generation callers and their tests. If it reports HIGH or CRITICAL risk, stop and report it before committing.

- [ ] **Step 7: Commit resolver work**

```bash
git add backend/app/Services/AiSeoGeneratorService.php backend/tests/Feature/Services/AiSeoGeneratorServiceTest.php backend/tests/Feature/Api/Admin/AiSeoControllerTest.php
git commit -m "feat(ai-seo): resolve providers with safe fallback"
```

### Task 4: Add masked Filament AI configuration controls

**Files:**
- Modify: `backend/app/Filament/Pages/ManageSettings.php`
- Create: `backend/tests/Feature/Filament/ManageSettingsTest.php`

**Interfaces:**
- Consumes `Setting::updateOrCreate()` through the existing `ManageSettings::save()` path and `AiSeoGeneratorService::configuredProviderNames()` / `activeProviderName()`.
- Produces persisted `ai_seo_provider`, provider keys, and provider models usable by Task 3, while not hydrating saved secret values back into form state.

- [ ] **Step 1: Write a failing Livewire settings test**

```php
public function test_ai_settings_persist_preference_and_model_without_hydrating_saved_keys(): void
{
    Setting::set('openai_api_key', 'stored-secret', 'string', 'ai');

    Livewire::test(ManageSettings::class)
        ->assertSet('data.openai_api_key', null)
        ->set('data.ai_seo_provider', 'openai')
        ->set('data.openai_model', 'account-approved-model')
        ->set('data.openai_api_key', 'replacement-secret')
        ->call('save')
        ->assertHasNoFormErrors();

    $this->assertSame('openai', Setting::get('ai_seo_provider'));
    $this->assertSame('account-approved-model', Setting::get('openai_model'));
    $this->assertSame('replacement-secret', Setting::get('openai_api_key'));
}
```

- [ ] **Step 2: Run the settings test and verify it fails before the AI tab exists**

Run: `php artisan test tests/Feature/Filament/ManageSettingsTest.php`

Expected: FAIL because the form has no `data.openai_*` state paths.

- [ ] **Step 3: Add secret-safe form hydration and the AI Settings tab**

In `ManageSettings`, define a private constant containing the four `*_api_key` setting keys. During `mount()`, skip those keys when filling `$data`; the blank `password()` inputs must preserve existing DB values because `save()` already skips blank values.

In `form()`, add `Tabs\Tab::make(__('AI Settings'))` containing:

```php
Select::make('ai_seo_provider')
    ->label(__('Preferred AI SEO Provider'))
    ->options([
        'auto' => 'Automatic (Anthropic → OpenAI → Grok → Gemini)',
        'anthropic' => 'Anthropic Claude',
        'openai' => 'OpenAI',
        'grok' => 'xAI Grok',
        'gemini' => 'Google Gemini',
    ])
    ->default('auto'),
TextInput::make('anthropic_api_key')->password()->label(__('Anthropic API Key')),
TextInput::make('anthropic_model')->label(__('Anthropic Model')),
Placeholder::make('ai_seo_active_provider')
    ->label(__('Configured AI SEO providers'))
    ->content(fn (): string => implode(', ', app(AiSeoGeneratorService::class)->configuredProviderNames()) ?: __('None')),
```

Repeat the paired masked key and model fields for `openai`, `xai`, and `gemini`. Add helper text explaining DB-over-environment precedence, that a blank key keeps the stored value, and that OpenAI/xAI/Gemini need both key and model. The public Settings controller remains untouched because it whitelists its fields and exposes no AI keys.

Extend `guessGroup()` to return `ai` for `ai_seo_provider`, `*_api_key`, and the four AI model keys.

- [ ] **Step 4: Re-run settings tests and inspect the form schema**

Run: `php artisan test tests/Feature/Filament/ManageSettingsTest.php`

Expected: PASS.

Run: `php artisan about --only=filament`

Expected: the application bootstraps without a form/schema exception.

- [ ] **Step 5: Run GitNexus change detection before committing the Settings UI**

Run the GitNexus `gitnexus_detect_changes()` MCP tool. Confirm the affected scope is the Settings management flow and the new AI form state. If it reports HIGH or CRITICAL risk, stop and report it before committing.

- [ ] **Step 6: Commit the Settings UI**

```bash
git add backend/app/Filament/Pages/ManageSettings.php backend/tests/Feature/Filament/ManageSettingsTest.php
git commit -m "feat(settings): configure AI SEO providers"
```

### Task 5: Replace audited light-surface orange text only

**Files:**
- Modify: `frontend/components/HomePage.tsx`
- Modify: `frontend/app/dogs/[slug]/page.tsx`
- Modify: `frontend/app/solutions/[slug]/page.tsx`
- Modify: `frontend/components/BlogPostPage.tsx`
- Modify: `frontend/components/ContactPage.tsx`
- Modify: `frontend/components/shop/ProductCard.tsx`
- Modify: `frontend/components/FaqsPage.tsx`
- Modify: `frontend/components/LegalPageLayout.tsx`

**Interfaces:**
- Consumes existing `C.rust` in `frontend/lib/uiTheme.ts` and existing Tailwind `text-rust` / `hover:text-rust` utilities.
- Produces no new tokens, components, or API contracts.

- [ ] **Step 1: Establish the failing contrast baseline from the known pairs**

Run this PowerShell calculation from the repository root:

```powershell
function Get-Contrast([string]$foreground, [string]$background) {
  function Get-Luminance([string]$hex) {
    $channels = @(0, 2, 4 | ForEach-Object { [Convert]::ToInt32($hex.TrimStart('#').Substring($_, 2), 16) / 255 })
    $linear = @($channels | ForEach-Object { if ($_ -le 0.04045) { $_ / 12.92 } else { [Math]::Pow(($_ + 0.055) / 1.055, 2.4) } })
    (0.2126 * $linear[0]) + (0.7152 * $linear[1]) + (0.0722 * $linear[2])
  }
  $a = Get-Luminance $foreground; $b = Get-Luminance $background
  [Math]::Round((([Math]::Max($a, $b) + 0.05) / ([Math]::Min($a, $b) + 0.05)), 2)
}
foreach ($background in '#ffffff', '#f4f5f6', '#fdf7f0', '#f6faff') {
  Write-Output "#df8448 on $background = $(Get-Contrast '#df8448' $background):1"
  Write-Output "#8f4a1f on $background = $(Get-Contrast '#8f4a1f' $background):1"
  Write-Output "#a8551a on $background = $(Get-Contrast '#a8551a' $background):1"
}
```

Expected: orange ranges from 2.55:1 to 2.79:1; inline `C.rust` ranges from 6.07:1 to 6.63:1; Tailwind rust ranges from 4.83:1 to 5.28:1.

- [ ] **Step 2: Apply only the audited inline-style replacements in HomePage**

Replace `C.secondary` with `C.rust` only for the following text properties:

```tsx
color: hoveredBreed === b.slug ? C.rust : C.primary
color: C.rust // Explore All Breeds
color: C.rust // Explore All Solutions
color: C.rust // The Practical Difference eyebrow
color: C.rust // Breed Banners Explore
color: isHovered ? C.rust : C.primary // PostCard title
color: isHovered ? C.rust : C.grayText // PostCard date/read time
color: C.rust // PostCard Read
```

Do not modify `Btn` variants, carousel dots, backgrounds, border colors, gradients, or `C.secondaryText` CTA backgrounds.

- [ ] **Step 3: Apply Tailwind class replacements on light surfaces**

Make these exact class substitutions:

```text
app/dogs/[slug]/page.tsx: text-[#df8448] → text-rust
app/solutions/[slug]/page.tsx: text-[#df8448] → text-rust
BlogPostPage.tsx first-letter utility: first-letter:text-secondary → first-letter:text-rust
BlogPostPage.tsx Read Story: text-secondary → text-rust
ContactPage.tsx contact label: text-secondary → text-rust
ProductCard.tsx Add to Cart: text-secondary → text-rust, retaining border-secondary bg-white hover:bg-secondary hover:text-ink
FaqsPage.tsx light navigation: hover:text-secondary → hover:text-rust
LegalPageLayout.tsx light navigation: hover:text-secondary → hover:text-rust
```

- [ ] **Step 4: Re-grep to verify exclusions remain unchanged**

Use the repository file-search tool with pattern `color:\\s*C\\.secondary|text-\\[#df8448\\]|text-secondary|hover:text-secondary`, path `frontend`, and include `*.tsx`.

Expected: no audited light-text instance remains; retained matches are dark-surface text, icon-only, background/border, or explicitly excluded ghost/decorative behavior.

- [ ] **Step 5: Read the local Next.js 16 documentation before frontend validation**

Read the relevant local guide under `frontend/node_modules/next/dist/docs/` for the existing CSS/class styling and Link/Image conventions touched by these components. Confirm no deprecated API is introduced; this task changes only existing styles/classes.

- [ ] **Step 6: Run TypeScript and production build**

Run: `pnpm exec tsc --noEmit`

Working directory: `frontend`

Expected: exit code 0.

Run: `pnpm run build`

Working directory: `frontend`

Expected: Next.js production build succeeds.

- [ ] **Step 7: Run GitNexus change detection before committing contrast fixes**

Run the GitNexus `gitnexus_detect_changes()` MCP tool. Confirm the affected scope is limited to the listed display components/pages and no SEO, cart, checkout, or authentication process appears. If it reports HIGH or CRITICAL risk, stop and report it before committing.

- [ ] **Step 8: Commit contrast fixes**

```bash
git add frontend/components/HomePage.tsx frontend/app/dogs/[slug]/page.tsx frontend/app/solutions/[slug]/page.tsx frontend/components/BlogPostPage.tsx frontend/components/ContactPage.tsx frontend/components/shop/ProductCard.tsx frontend/components/FaqsPage.tsx frontend/components/LegalPageLayout.tsx
git commit -m "fix(a11y): use accessible rust text on light surfaces"
```

### Task 6: Run integrated verification and inspect scope

**Files:**
- Test: `backend/tests/Feature/Services/AiSeoGeneratorServiceTest.php`
- Test: `backend/tests/Feature/Services/AiSeoProvidersTest.php`
- Test: `backend/tests/Feature/Api/Admin/AiSeoControllerTest.php`

**Interfaces:**
- Consumes all work from Tasks 1–5.
- Produces evidence that provider fallback, public contract preservation, contrast remediation, static checks, and production build meet the approved spec.

- [ ] **Step 1: Format backend changes**

Run: `./vendor/bin/pint --dirty`

Working directory: `backend`

Expected: exit code 0. Re-run targeted tests if Pint changes any PHP file.

- [ ] **Step 2: Run all AI SEO backend tests**

Run: `php artisan test tests/Feature/Services/AiSeoGeneratorServiceTest.php tests/Feature/Services/AiSeoProvidersTest.php tests/Feature/Api/Admin/AiSeoControllerTest.php`

Working directory: `backend`

Expected: all listed tests pass with no network traffic.

- [ ] **Step 3: Run backend analysis and complete backend test suite**

Run: `composer analyse`

Working directory: `backend`

Expected: no new PHPStan errors.

Run: `composer test`

Working directory: `backend`

Expected: test suite passes; report pre-existing failures separately if any.

- [ ] **Step 4: Verify contrast values and source scope again**

Re-run the WCAG relative-luminance calculation from Task 5, then inspect each changed hunk with:

```bash
git diff --check
git diff -- backend frontend
git status --short
```

Expected: no whitespace errors; changed files are only the plan/spec, AI SEO implementation/config/tests, and the audited frontend components/pages.

- [ ] **Step 5: Run GitNexus change detection before final commit**

Run the GitNexus `gitnexus_detect_changes()` MCP tool against the final working-tree diff. Confirm the affected symbols/processes match AI SEO generation, Settings management, and the listed frontend display components. If it reports HIGH or CRITICAL risk, stop and report that risk before committing.

- [ ] **Step 6: Make the final integration commit**

```bash
git add backend frontend docs/superpowers/specs/2026-09-01-ai-seo-accessibility-design.md docs/superpowers/plans/2026-09-01-ai-seo-accessibility.md
git commit -m "feat: add resilient AI SEO and contrast fixes"
```

- [ ] **Step 7: Report evidence without deployment**

Report the configured-provider behavior, Anthropic fallback, safe error/fallback behavior, exact frontend accessibility scope, test/build/analysis results, and branch/worktree path. State explicitly that production deployment and live PageSpeed were not performed.
