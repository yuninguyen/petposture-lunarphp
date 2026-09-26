<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Concerns\ResolvesDateRangePreset;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class DashboardSalesRequest extends FormRequest
{
    use ResolvesDateRangePreset;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'range' => ['nullable', 'string', Rule::in(['7', '30', '90', '365', 'all'])],
            'preset' => self::presetRules(),
            'quarter' => ['required_if:preset,quarter', 'string', 'regex:/^\d{4}-Q[1-4]$/'],
            'start_date' => ['required_if:preset,custom', 'date_format:Y-m-d'],
            'end_date' => ['required_if:preset,custom', 'date_format:Y-m-d', 'after_or_equal:start_date'],
            'comparison' => ['nullable', 'string', Rule::in(['none', 'yesterday', 'previous_year', 'previous_year_match_day', 'custom'])],
            'compare_start_date' => ['required_if:comparison,custom', 'date_format:Y-m-d'],
            'compare_end_date' => ['required_if:comparison,custom', 'date_format:Y-m-d', 'after_or_equal:compare_start_date'],
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

    public function resolveComparison(Carbon $primaryStart, Carbon $primaryEnd): ?array
    {
        $comparison = (string) ($this->validated('comparison') ?: 'none');
        $spanDays = (int) $primaryStart->diffInDays($primaryEnd) + 1;

        return match ($comparison) {
            'none' => null,
            'yesterday' => $spanDays === 1
                ? ['start' => $primaryStart->copy()->subDay(), 'end' => $primaryEnd->copy()->subDay(), 'label' => 'Yesterday']
                : throw ValidationException::withMessages(['comparison' => ['Yesterday comparison requires a single-day primary range.']]),
            'previous_year' => ['start' => $primaryStart->copy()->subYear(), 'end' => $primaryEnd->copy()->subYear(), 'label' => 'Previous year'],
            'previous_year_match_day' => ['start' => $primaryStart->copy()->subDays(364), 'end' => $primaryEnd->copy()->subDays(364), 'label' => 'Previous year (match day of week)'],
            'custom' => ['start' => Carbon::createFromFormat('Y-m-d', $this->validated('compare_start_date'))->startOfDay(), 'end' => Carbon::createFromFormat('Y-m-d', $this->validated('compare_end_date'))->endOfDay(), 'label' => 'Custom'],
            default => null,
        };
    }
}
