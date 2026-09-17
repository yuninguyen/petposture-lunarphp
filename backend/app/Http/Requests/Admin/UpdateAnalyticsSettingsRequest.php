<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateAnalyticsSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'google_analytics_id' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            foreach (array_diff(array_keys($this->all()), ['google_analytics_id']) as $field) {
                $validator->errors()->add($field, 'The field is not allowed.');
            }
        }];
    }
}
