<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class FetchAiModelsRequest extends FormRequest
{
    private const FIELDS = [
        'openai_api_key',
        'openai_base_url',
        'openai_model',
    ];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'fields' => ['sometimes', 'array:'.implode(',', self::FIELDS)],
            'fields.openai_api_key' => ['sometimes', 'nullable', 'string', 'max:4096'],
            'fields.openai_base_url' => ['sometimes', 'nullable', 'url:http,https', 'max:2048'],
            'fields.openai_model' => ['sometimes', 'nullable', 'string', 'max:255'],
            'clear_fields' => ['sometimes', 'array'],
            'clear_fields.*' => ['string', 'distinct', Rule::in(self::FIELDS)],
        ];
    }

    public function after(): array
    {
        return [$this->rejectUnexpectedAndConflictingFields(...)];
    }

    private function rejectUnexpectedAndConflictingFields(Validator $validator): void
    {
        foreach (array_diff(array_keys($this->all()), ['fields', 'clear_fields']) as $field) {
            $validator->errors()->add($field, 'This field is not allowed.');
        }

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
