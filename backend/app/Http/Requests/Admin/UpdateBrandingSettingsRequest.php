<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateBrandingSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'admin_logo' => ['sometimes', 'nullable', 'array:media_id'],
            'admin_logo.media_id' => ['required_with:admin_logo', 'string', 'exists:curator_media,id'],
            'admin_favicon' => ['sometimes', 'nullable', 'array:media_id'],
            'admin_favicon.media_id' => ['required_with:admin_favicon', 'string', 'exists:curator_media,id'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            foreach (array_diff(array_keys($this->all()), ['admin_logo', 'admin_favicon']) as $field) {
                $validator->errors()->add($field, 'The field is not allowed.');
            }
        }];
    }
}
