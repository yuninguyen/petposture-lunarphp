<?php

namespace App\Http\Requests\Api;

use App\Data\CheckoutSessionPayload;
use Illuminate\Foundation\Http\FormRequest;

class UpsertCheckoutSessionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'token' => ['nullable', 'uuid'],
            'items' => ['nullable', 'array'],
            'items.*.variantId' => ['required_with:items', 'integer', 'exists:lunar_product_variants,id'],
            'items.*.quantity' => ['required_with:items', 'integer', 'min:1'],
            'shipping' => ['nullable', 'array'],
            'shipping.email' => ['nullable', 'email'],
            'shipping.first_name' => ['nullable', 'string', 'max:255'],
            'shipping.last_name' => ['nullable', 'string', 'max:255'],
            'shipping.company' => ['nullable', 'string', 'max:255'],
            'shipping.line_one' => ['nullable', 'string', 'max:255'],
            'shipping.line_two' => ['nullable', 'string', 'max:255'],
            'shipping.city' => ['nullable', 'string', 'max:255'],
            'shipping.state' => ['nullable', 'string', 'max:255'],
            'shipping.postcode' => ['nullable', 'string', 'max:32'],
            'shipping.country' => ['nullable', 'string', 'max:255'],
            'shipping.phone' => ['nullable', 'string', 'max:50'],
            'billing_same_as_shipping' => ['nullable', 'boolean'],
            'billing' => ['nullable', 'array'],
            'billing.email' => ['nullable', 'email'],
            'billing.first_name' => ['nullable', 'string', 'max:255'],
            'billing.last_name' => ['nullable', 'string', 'max:255'],
            'billing.company' => ['nullable', 'string', 'max:255'],
            'billing.line_one' => ['nullable', 'string', 'max:255'],
            'billing.line_two' => ['nullable', 'string', 'max:255'],
            'billing.city' => ['nullable', 'string', 'max:255'],
            'billing.state' => ['nullable', 'string', 'max:255'],
            'billing.postcode' => ['nullable', 'string', 'max:32'],
            'billing.country' => ['nullable', 'string', 'max:255'],
            'billing.phone' => ['nullable', 'string', 'max:50'],
            'shipping_method' => ['nullable', 'string', 'max:50'],
            'payment_method' => ['nullable', 'string', 'max:50'],
            'coupon_code' => ['nullable', 'string', 'max:255'],
            'customer_note' => ['nullable', 'string', 'max:2000'],
        ];
    }

    public function checkoutPayload(): array
    {
        return CheckoutSessionPayload::sanitize($this->validated(), includeToken: true);
    }
}
