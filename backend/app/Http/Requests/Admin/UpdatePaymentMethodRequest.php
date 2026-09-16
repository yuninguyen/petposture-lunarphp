<?php

namespace App\Http\Requests\Admin;

use App\Services\Admin\PaymentMethodService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdatePaymentMethodRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(PaymentMethodService $paymentMethods): array
    {
        $gateway = (string) $this->route('gateway');
        $fields = $paymentMethods->fieldNames($gateway);
        $rules = [
            'mode' => ['sometimes', 'string', Rule::in($paymentMethods->modeValues($gateway))],
            'fields' => ['sometimes', 'array:'.implode(',', $fields)],
            'clear_fields' => ['sometimes', 'array'],
            'clear_fields.*' => ['string', 'distinct', Rule::in($fields)],
        ];

        foreach ($fields as $field) {
            $rules["fields.{$field}"] = ['sometimes', 'nullable', 'string'];
        }

        return $rules;
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            foreach ($this->input('clear_fields', []) as $field) {
                $replacement = $this->input("fields.{$field}");
                if (is_string($replacement) && trim($replacement) !== '') {
                    $validator->errors()->add("fields.{$field}", 'A field cannot be replaced and cleared together.');
                }
            }
        }];
    }
}
