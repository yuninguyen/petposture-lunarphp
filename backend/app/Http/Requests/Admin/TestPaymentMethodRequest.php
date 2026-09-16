<?php

namespace App\Http\Requests\Admin;

use App\Services\Admin\PaymentMethodService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class TestPaymentMethodRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(PaymentMethodService $paymentMethods): array
    {
        $gateway = (string) $this->route('gateway');
        $fields = $paymentMethods->connectionFieldNames($gateway);
        $rules = [
            'mode' => ['sometimes', 'string', Rule::in($paymentMethods->modeValues($gateway))],
            'fields' => ['sometimes', 'array:'.implode(',', $fields)],
        ];

        foreach ($fields as $field) {
            $rules["fields.{$field}"] = ['sometimes', 'nullable', 'string'];
        }

        return $rules;
    }
}
