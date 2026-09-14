<?php

namespace App\Http\Requests\Concerns;

use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

trait ResolvesDateRangePreset
{
    public static function presetRules(): array
    {
        return ['nullable', 'string', Rule::in([
            'today', 'yesterday',
            'last_7_days', 'last_30_days', 'last_90_days', 'last_365_days',
            'last_week', 'last_month', 'last_quarter', 'last_12_months', 'last_year',
            'week_to_date', 'month_to_date', 'quarter_to_date', 'year_to_date',
            'quarter', 'custom',
        ])];
    }

    public function resolveDateRangePreset(string $preset, ?string $quarter, ?string $startDate, ?string $endDate): array
    {
        $now = Carbon::now();

        return match ($preset) {
            'today' => ['start' => $now->copy()->startOfDay(), 'end' => $now->copy()->endOfDay(), 'label' => 'Today'],
            'yesterday' => ['start' => $now->copy()->subDay()->startOfDay(), 'end' => $now->copy()->subDay()->endOfDay(), 'label' => 'Yesterday'],
            'last_7_days' => ['start' => $now->copy()->subDays(6)->startOfDay(), 'end' => $now->copy()->endOfDay(), 'label' => 'Last 7 days'],
            'last_30_days' => ['start' => $now->copy()->subDays(29)->startOfDay(), 'end' => $now->copy()->endOfDay(), 'label' => 'Last 30 days'],
            'last_90_days' => ['start' => $now->copy()->subDays(89)->startOfDay(), 'end' => $now->copy()->endOfDay(), 'label' => 'Last 90 days'],
            'last_365_days' => ['start' => $now->copy()->subDays(364)->startOfDay(), 'end' => $now->copy()->endOfDay(), 'label' => 'Last 365 days'],
            'last_week' => ['start' => $now->copy()->subWeek()->startOfWeek(), 'end' => $now->copy()->subWeek()->endOfWeek(), 'label' => 'Last week'],
            'last_month' => ['start' => $now->copy()->subMonthNoOverflow()->startOfMonth(), 'end' => $now->copy()->subMonthNoOverflow()->endOfMonth(), 'label' => 'Last month'],
            'last_quarter' => ['start' => $now->copy()->subQuarterNoOverflow()->startOfQuarter(), 'end' => $now->copy()->subQuarterNoOverflow()->endOfQuarter(), 'label' => 'Last quarter'],
            'last_12_months' => ['start' => $now->copy()->subMonthsNoOverflow(12)->startOfMonth(), 'end' => $now->copy()->endOfDay(), 'label' => 'Last 12 months'],
            'last_year' => ['start' => $now->copy()->subYearNoOverflow()->startOfYear(), 'end' => $now->copy()->subYearNoOverflow()->endOfYear(), 'label' => 'Last year'],
            'week_to_date' => ['start' => $now->copy()->startOfWeek(), 'end' => $now->copy()->endOfDay(), 'label' => 'Week to date'],
            'month_to_date' => ['start' => $now->copy()->startOfMonth(), 'end' => $now->copy()->endOfDay(), 'label' => 'Month to date'],
            'quarter_to_date' => ['start' => $now->copy()->startOfQuarter(), 'end' => $now->copy()->endOfDay(), 'label' => 'Quarter to date'],
            'year_to_date' => ['start' => $now->copy()->startOfYear(), 'end' => $now->copy()->endOfDay(), 'label' => 'Year to date'],
            'quarter' => $this->resolveQuarterPreset((string) $quarter),
            'custom' => [
                'start' => Carbon::createFromFormat('Y-m-d', (string) $startDate)->startOfDay(),
                'end' => Carbon::createFromFormat('Y-m-d', (string) $endDate)->endOfDay(),
                'label' => 'Custom',
            ],
            default => ['start' => $now->copy()->subDays(29)->startOfDay(), 'end' => $now->copy()->endOfDay(), 'label' => 'Last 30 days'],
        };
    }

    private function resolveQuarterPreset(string $quarter): array
    {
        [$year, $q] = explode('-Q', $quarter);
        $start = Carbon::createFromDate((int) $year, ((int) $q - 1) * 3 + 1, 1)->startOfQuarter();

        return ['start' => $start, 'end' => $start->copy()->endOfQuarter(), 'label' => "Q{$q} {$year}"];
    }
}
