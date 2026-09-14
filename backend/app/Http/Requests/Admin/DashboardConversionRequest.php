<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Concerns\ResolvesDateRangePreset;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DashboardConversionRequest extends FormRequest
{
    use ResolvesDateRangePreset;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'range' => ['nullable', 'string', Rule::in(['7', '30', '90', 'all'])],
            'preset' => self::presetRules(),
            'quarter' => ['required_if:preset,quarter', 'string', 'regex:/^\d{4}-Q[1-4]$/'],
            'start_date' => ['required_if:preset,custom', 'date_format:Y-m-d'],
            'end_date' => ['required_if:preset,custom', 'date_format:Y-m-d', 'after_or_equal:start_date'],
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
            'all' => null,
            default => 30,
        };
    }

    public function usesPreset(): bool
    {
        return $this->filled('preset');
    }

    public function resolveRange(): array
    {
        return $this->resolveDateRangePreset(
            (string) $this->validated('preset'),
            $this->validated('quarter'),
            $this->validated('start_date'),
            $this->validated('end_date')
        );
    }
}
