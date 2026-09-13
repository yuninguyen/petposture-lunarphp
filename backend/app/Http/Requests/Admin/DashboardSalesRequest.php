<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DashboardSalesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'range' => ['nullable', 'string', Rule::in(['7', '30', '90', '365', 'all'])],
        ];
    }

    public function range(): string
    {
        return (string) ($this->validated('range') ?: '30');
    }

    public function rangeDays(): ?int
    {
        return match ($this->range()) {
            '7' => 7,
            '90' => 90,
            '365' => 365,
            'all' => null,
            default => 30,
        };
    }
}
