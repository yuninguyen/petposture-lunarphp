<?php

namespace App\Http\Requests\Admin;

use App\Services\Admin\SecureSettingsService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateAiSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(SecureSettingsService $settings): array
    {
        return [
            'fields' => ['sometimes', 'array:'.implode(',', $settings->aiFieldNames())],
            'fields.ai_seo_provider' => ['sometimes', 'nullable', 'string', Rule::in($settings->aiProviderValues())],
            'fields.anthropic_api_key' => ['sometimes', 'nullable', 'string', 'max:4096'],
            'fields.anthropic_model' => ['sometimes', 'nullable', 'string', 'max:255'],
            'fields.openai_api_key' => ['sometimes', 'nullable', 'string', 'max:4096'],
            'fields.openai_model' => ['sometimes', 'nullable', 'string', 'max:255'],
            'fields.openai_base_url' => ['sometimes', 'nullable', 'url:http,https', 'max:2048'],
            'fields.xai_api_key' => ['sometimes', 'nullable', 'string', 'max:4096'],
            'fields.xai_model' => ['sometimes', 'nullable', 'string', 'max:255'],
            'fields.gemini_api_key' => ['sometimes', 'nullable', 'string', 'max:4096'],
            'fields.gemini_model' => ['sometimes', 'nullable', 'string', 'max:255'],
            'clear_fields' => ['sometimes', 'array'],
            'clear_fields.*' => ['string', 'distinct', Rule::in($settings->aiFieldNames())],
        ];
    }

    public function after(): array
    {
        return [$this->rejectReplacementClearConflicts(...)];
    }

    private function rejectReplacementClearConflicts(Validator $validator): void
    {
        if ($validator->errors()->isNotEmpty()) {
            return;
        }

        foreach ($this->input('clear_fields', []) as $field) {
            $replacement = $this->input("fields.{$field}");
            if (is_string($replacement) && trim($replacement) !== '') {
                $validator->errors()->add("fields.{$field}", 'A field cannot be replaced and cleared together.');
            }
        }
    }
}
