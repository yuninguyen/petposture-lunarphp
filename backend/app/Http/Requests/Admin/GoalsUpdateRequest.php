<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class GoalsUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'monthly_revenue_target' => ['nullable', 'numeric', 'min:0'],
            'monthly_orders_target' => ['nullable', 'integer', 'min:0'],
            'monthly_new_customers_target' => ['nullable', 'integer', 'min:0'],
        ];
    }
}
