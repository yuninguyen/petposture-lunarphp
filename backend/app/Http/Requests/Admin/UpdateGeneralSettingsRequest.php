<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateGeneralSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'shop_name' => ['sometimes', 'string', 'max:255'],
            'shop_description' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'shop_logo' => ['sometimes', 'nullable', 'array:media_id'],
            'shop_logo.media_id' => [Rule::excludeIf(! $this->has('shop_logo') || $this->input('shop_logo') === null), 'required', 'string', 'exists:curator_media,id'],
            'shop_favicon' => ['sometimes', 'nullable', 'array:media_id'],
            'shop_favicon.media_id' => [Rule::excludeIf(! $this->has('shop_favicon') || $this->input('shop_favicon') === null), 'required', 'string', 'exists:curator_media,id'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            foreach (array_diff(array_keys($this->all()), ['shop_name', 'shop_description', 'shop_logo', 'shop_favicon']) as $field) {
                $validator->errors()->add($field, 'The field is not allowed.');
            }
        }];
    }
}
