<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
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
            'admin_logo.media_id' => [Rule::excludeIf(! $this->has('admin_logo') || $this->input('admin_logo') === null), 'required', 'string', 'exists:curator_media,id'],
            'admin_favicon' => ['sometimes', 'nullable', 'array:media_id'],
            'admin_favicon.media_id' => [Rule::excludeIf(! $this->has('admin_favicon') || $this->input('admin_favicon') === null), 'required', 'string', 'exists:curator_media,id'],
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
