# Plan — Sales Dashboard: Shopify-style Date Range Picker + Comparison

Added after Phase 1B (Conversion Report) shipped, per user request (2026-09-14). Scope is limited to `admin/src/features/dashboard/SalesPage.tsx` and its backend (`DashboardSalesController.php`, `DashboardSalesRequest.php`). Does **not** touch the Conversion Report (`DashboardConversionController.php`), which keeps its own simple `range=7|30|90|all` enum — these are two independent features that happen to share the same nav group.

## Why

Current Sales dashboard only offers 5 fixed range pills (`7|30|90|365|all`, `DashboardSalesRequest.php:18`) and a hardcoded "trend" comparison against "the immediately preceding period of equal length" (`DashboardSalesController.php:70-100`, computed via `$prevPeriodStart = $now->copy()->subDays($rangeDays * 2)`). User wants a Shopify-style two-dropdown header: a rich date-range picker, and a separate, user-selectable comparison-period picker — confirmed via real Shopify Analytics screenshots and Shopify's own help docs (comparison renders as an overlaid second line on the chart, dotted/faded vs the current period's solid line, plus a `%` badge on top-line KPI cards).

## Confirmed scope decisions (do not re-litigate)

1. **Comparison applies only to the 3 top KPI cards (Sales, AOV, Orders) + the `sales_over_time` chart.** Returns & Refunds' existing `refund_trend`, Top Products, Sales By Category, Recent Orders are unaffected — they keep showing only the primary period, no comparison overlay.
2. **"Yesterday" comparison option is hidden unless the primary date range resolves to exactly 1 day** (i.e. `preset=today` or `preset=custom` with `start_date === end_date`). Comparing "Yesterday" against a 30-day primary range is misleading and out of scope.
3. Comparison option set is **exactly** `none | yesterday | previous_year | previous_year_match_day | custom` — this is the literal set shown in the user's real Shopify account screenshot. Do not add "Previous period" even though it appears in generic Shopify documentation — it is not part of the requested scope.

## Date Range Picker (first dropdown)

Menu structure (Black Friday/Cyber Monday explicitly excluded per user):

- **Today**
- **Yesterday**
- **Last** →  Last 7 days / Last 30 days / Last 90 days / Last 365 days / Last week / Last month / Last quarter / Last 12 months / Last year
- **Period to date** → Week to date / Month to date / Quarter to date / Year to date
- **Quarters** → dynamically list the current quarter and the previous 3 (e.g. if today is in Q3 2026: Q3 2026, Q2 2026, Q1 2026, Q4 2025)
- **Custom range** → two date inputs (`YYYY-MM-DD`), resolves to `[start_date, end_date]`

### Backend contract change

Replace `DashboardSalesRequest`'s `range` enum (`Rule::in(['7','30','90','365','all'])`) with:

```php
'preset' => ['required', 'string', Rule::in([
    'today', 'yesterday',
    'last_7_days', 'last_30_days', 'last_90_days', 'last_365_days',
    'last_week', 'last_month', 'last_quarter', 'last_12_months', 'last_year',
    'week_to_date', 'month_to_date', 'quarter_to_date', 'year_to_date',
    'quarter', 'custom',
])],
'quarter' => ['required_if:preset,quarter', 'string', 'regex:/^\d{4}-Q[1-4]$/'],
'start_date' => ['required_if:preset,custom', 'date_format:Y-m-d'],
'end_date' => ['required_if:preset,custom', 'date_format:Y-m-d', 'after_or_equal:start_date'],
'comparison' => ['nullable', 'string', Rule::in(['none', 'yesterday', 'previous_year', 'previous_year_match_day', 'custom'])],
'compare_start_date' => ['required_if:comparison,custom', 'date_format:Y-m-d'],
'compare_end_date' => ['required_if:comparison,custom', 'date_format:Y-m-d', 'after_or_equal:compare_start_date'],
```

Add a `DashboardSalesRequest::resolveRange(): array{start: Carbon, end: Carbon, label: string}` method that turns `preset` (+ `quarter`/`start_date`/`end_date`) into concrete `[start, end]` Carbon instances — **all date math happens server-side, once, as the single source of truth**. Do not duplicate preset-to-date-range logic in the frontend; the frontend only sends the preset key (or custom dates) and displays whatever `label`/dates the backend echoes back in the response.

Key date-math specifics (Carbon, app timezone — check `config('app.timezone')`, do not assume UTC-only math will match what "Today" means to the shop's actual timezone):
- `today` → `[now->startOfDay(), now->endOfDay()]`
- `yesterday` → `[now->copy()->subDay()->startOfDay(), now->copy()->subDay()->endOfDay()]`
- `last_7_days`/`last_30_days`/`last_90_days`/`last_365_days` → same semantics as today's existing `rangeDays()` (N days back from now, inclusive of today) — this preserves the existing Sales numbers for users who don't touch the new picker, so **do not silently change what "Last 30 days" means**.
- `last_week`/`last_month`/`last_quarter`/`last_12_months`/`last_year` → the **immediately preceding complete** calendar unit (e.g. `last_week` = the Mon-Sun (or your locale's week start) before this week, `last_month` = the whole of last calendar month, not "30 days back").
- `week_to_date`/`month_to_date`/`quarter_to_date`/`year_to_date` → `[startOfWeek/Month/Quarter/Year(), now()]`.
- `quarter` → parse `2026-Q3` into `[Carbon::parse('2026-07-01')->startOfQuarter(), same->endOfQuarter()]`.

### Comparison resolution

Add `DashboardSalesRequest::resolveComparison(Carbon $primaryStart, Carbon $primaryEnd): ?array{start: Carbon, end: Carbon, label: string}`:

- `none` → `null` (existing behavior for anyone not using the new comparison dropdown — **preserve current hardcoded "previous period of equal length" trend behavior as the default** when `comparison` is omitted entirely, so existing trend badges don't regress for API consumers that don't pass the new param).
- `yesterday` → only valid when `primaryStart`/`primaryEnd` span exactly 1 day; else reject with a 422 (`comparison` invalid for this range) — this is the enforcement point for scope decision #2 above. Mirror this restriction in the frontend by hiding the option, but the backend must independently enforce it (never trust the frontend to have hidden it).
- `previous_year` → shift both `primaryStart`/`primaryEnd` back by exactly 1 calendar year (`->subYear()`), preserving month/day. Handle Feb 29 leap-year edge case (Carbon's `subYear()` already clamps Feb 29 → Feb 28 on non-leap years — verify this is the desired behavior, don't add extra handling unless a test proves otherwise).
- `previous_year_match_day` → shift back by exactly **364 days** (52 weeks), not 365 — this is what aligns day-of-week (e.g. a Monday stays a Monday), which is the entire point of this option per its name. Compute the day-count between `primaryStart`/`primaryEnd` and preserve that same length, shifted 364 days back from `primaryStart`.
- `custom` → use `compare_start_date`/`compare_end_date` directly, no derivation.

### Controller changes (`DashboardSalesController.php`)

- `calculateStats()` already computes `$salesTrend`/`$ordersTrend`/`$aovTrend` against `$prevPeriodStart`..`$periodStart` — refactor so the "previous period" bounds come from `resolveComparison()` instead of the current `$now->copy()->subDays($rangeDays * 2)` computation. Keep the **shape** of the response identical (`trend` field name unchanged) so the frontend for the 3 KPI cards needs minimal changes beyond labels.
- `calculateSalesOverTime()`: when a comparison range is active, additionally compute a second `series.revenue_compare`/`series.orders_compare` array **aligned by index** to the primary series (e.g. primary index 0 = first day of primary range, compare index 0 = first day of comparison range) — do not try to align by calendar date, since a "previous year" comparison range's dates don't overlap the primary range's x-axis labels. The chart's x-axis stays labeled with the **primary** period's dates/categories; the comparison series is plotted against those same x-positions purely by index.
- `calculateReturnsSummary()`, `calculateOrderPipeline()`, `calculateTopProducts()`, `calculateSalesByCategory()`, `getRecentOrders()`: **unchanged** — these do not get comparison data per scope decision #1. They should keep using the resolved primary `[start, end]` only.
- Response `data.range` changes shape from a string to an object: `{ preset, start, end, label }`. This is a breaking response-shape change — check `admin/src/features/dashboard/api.ts:110` (`DashboardSalesData.range: string`) and update the TS type together with the controller change in the same PR, and update `SalesPage.tsx`'s any usage of `data.range` (currently only used indirectly via the `range !== 'all'` check for `TrendBadge`, `SalesPage.tsx:84,102,143,158` — replace that check with whatever the new response tells the frontend about whether a trend/comparison is meaningful for the current selection, e.g. a `comparison_active: boolean` field, rather than string-comparing against `'all'`).

### Tests

Update `DashboardSalesControllerTest.php` for the new request shape (all existing assertions currently keyed on `range=7|30|90|365|all` need equivalent `preset=` values — e.g. `range=30` becomes `preset=last_30_days`). Add new tests:
- Each preset resolves to the correct `[start, end]` via direct Carbon assertions.
- `quarter` preset with a specific `2026-Q3` value.
- `custom` preset validation (start after end → 422; missing dates when `preset=custom` → 422).
- Comparison `previous_year_match_day` produces a range exactly 364 days before, same length as primary.
- Comparison `yesterday` rejected (422) when primary range spans more than 1 day.
- `sales_over_time` compare series has the same array length as the primary series when a comparison is active.
- No comparison fields appear in `returns_summary`/`top_products`/`sales_by_category`/`recent_orders` beyond what already existed (guards against accidentally spreading comparison scope creep).

## Frontend (`admin/src/features/dashboard/`)

### New component: `DateRangePicker.tsx`

A dropdown replacing the current pill row (`SalesPage.tsx:49-65`). Structure: left sidebar list of preset groups (flat items: Today, Yesterday; expandable sub-lists: Last, Period to date, Quarters; Custom range) + a two-month calendar side panel that only activates for `Quarters` (to preview the selected quarter's span) and `Custom range` (for picking arbitrary start/end). Use a date-picker library for the calendar grid itself (check `admin/package.json` for whether one is already installed before adding a new dependency — do not add a second date library if one is already present for another feature).

State shape: `{ preset: string; quarter?: string; startDate?: string; endDate?: string }`, lifted in `SalesPage.tsx`, passed to `useDashboardSales`.

### New component: `ComparisonPicker.tsx`

Second dropdown, simple flat list: No comparison / Yesterday (hidden unless primary range is exactly 1 day — read this from the picker's own resolved range, or from the API response's echoed `start`/`end` once loaded) / Previous year / Previous year (match day of week) / Custom (reveals two date inputs).

### `api.ts` changes

- `DashboardSalesData.range` type changes from `string` to `{ preset: string; start: string; end: string; label: string; comparison_active: boolean }` (match whatever exact shape the backend ends up returning — keep this in lockstep with the controller PR, do not implement frontend and backend in separate uncoordinated passes for this shape).
- `SalesOverTime` gains optional `series.revenue_compare?: number[]` / `series.orders_compare?: number[]`.
- `fetchDashboardSales`/`useDashboardSales` signature changes from `(range: string)` to accept the full picker state object; build the query string from all the new params (`preset`, `quarter`, `start_date`, `end_date`, `comparison`, `compare_start_date`, `compare_end_date`) rather than the single `range` string.

### `SalesPage.tsx` changes

- Replace the pill row with `<DateRangePicker />` + `<ComparisonPicker />` side by side in the header.
- `TrendBadge` (`SalesPage.tsx:450-461`) currently takes `rangeDays: boolean` derived from `range !== 'all'` — replace with the new `comparison_active` flag from the response; when comparison is `none`, show no badge instead of the current "All time" fallback text (the "All time" text was a proxy for "no meaningful previous period to compare against", which is now explicit via `comparison_active`).
- `SalesSvgChart` (`SalesPage.tsx:488-533`) needs a second polyline (dashed, per Shopify's dotted/faded convention) for `revenue_compare` and `orders_compare` when present, sharing the same x-axis positions as the primary series (same `getX(index)` function, since both arrays are the same length per the backend contract above).

### Tests

Update `SalesPage.test.tsx` for the new props/state shape. New tests for `DateRangePicker.tsx` and `ComparisonPicker.tsx` covering: correct preset list, "Yesterday" comparison option hidden/shown based on primary range length, custom range date validation (end before start disabled/rejected client-side too, as a UX nicety — but the backend 422 remains the actual enforcement per the test list above).

### Locales

New EN + VI strings for every preset label, comparison label, and the custom-range picker's UI text.

## Release gate

- All existing Sales dashboard numbers for the 5 old presets (mapped to their `last_N_days`/`year`/`all`-equivalent new presets) are byte-for-byte identical to pre-change numbers — this is a refactor of the range mechanism, not a change to what any given "Last 30 days" means.
- Comparison overlay only ever appears on the 3 KPI cards + chart, never elsewhere.
- "Yesterday" comparison option is unselectable (frontend) and rejected (backend, 422) whenever the primary range is not exactly 1 day.
- Mobile: both dropdowns collapse/stack without horizontal overflow.
