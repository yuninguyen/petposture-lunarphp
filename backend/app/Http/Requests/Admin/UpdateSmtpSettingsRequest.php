<?php

namespace App\Http\Requests\Admin;

use App\Services\Admin\SecureSettingsService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateSmtpSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(SecureSettingsService $settings): array
    {
        return [
            'fields' => ['sometimes', 'array:'.implode(',', $settings->smtpFieldNames())],
            'fields.smtp_host' => ['sometimes', 'nullable', 'string', 'max:255'],
            'fields.smtp_port' => ['sometimes', 'nullable', 'integer', 'between:1,65535'],
            'fields.smtp_user' => ['sometimes', 'nullable', 'string', 'max:255'],
            'fields.smtp_pass' => ['sometimes', 'nullable', 'string', 'max:4096'],
            'fields.smtp_encryption' => ['sometimes', 'nullable', Rule::in(['tls', 'ssl', 'none'])],
            'fields.mail_from_address' => ['sometimes', 'nullable', 'email:rfc', 'max:255'],
            'clear_fields' => ['sometimes', 'array'],
            'clear_fields.*' => ['string', 'distinct', Rule::in($settings->smtpFieldNames())],
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
