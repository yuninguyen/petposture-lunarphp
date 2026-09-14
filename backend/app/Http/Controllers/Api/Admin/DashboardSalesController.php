<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\DashboardSalesRequest;
use App\Models\OrderReturnRequest;
use App\Models\Review;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Lunar\Models\Currency;
use Lunar\Models\Order;
use Lunar\Models\OrderLine;
use Spatie\Permission\Exceptions\RoleDoesNotExist;

class DashboardSalesController extends Controller
{
    public function index(DashboardSalesRequest $request): JsonResponse
    {
        $now = Carbon::now();
        $currencyCode = Currency::getDefault()?->code ?? 'USD';

        if ($request->usesPreset()) {
            $primary = $request->resolveRange();
            $periodStart = $primary['start'];
            $periodEnd = $primary['end'];
            $compare = $request->resolveComparison($periodStart, $periodEnd);
            $comparisonActive = $compare !== null;

            $compareStart = $compare ? $compare['start'] : null;
            $compareEnd = $compare ? $compare['end'] : null;

            $stats = $this->calculateStats(
                $periodStart,
                $periodEnd,
                $compareStart,
                $compareEnd,
                $comparisonActive,
                $currencyCode
            );

            $returnsSummary = $this->calculateReturnsSummaryPreset($periodStart, $periodEnd);
            $salesOverTime = $this->calculateSalesOverTimeForRange($periodStart, $periodEnd, $compareStart);
            $orderPipeline = $this->calculateOrderPipeline($periodStart, $periodEnd);
            $topProducts = $this->calculateTopProducts($periodStart, $periodEnd, $currencyCode);
            $salesByCategory = $this->calculateSalesByCategory($periodStart, $periodEnd, $currencyCode);

            $rangeData = [
                'preset' => (string) $request->validated('preset'),
                'start' => $periodStart->toDateString(),
                'end' => $periodEnd->toDateString(),
                'label' => $primary['label'],
                'comparison_active' => $comparisonActive,
            ];
        } else {
            $range = $request->range();
            $rangeDays = $request->rangeDays();

            $periodStart = $rangeDays ? $now->copy()->subDays($rangeDays) : null;
            $prevPeriodStart = $rangeDays ? $now->copy()->subDays($rangeDays * 2) : null;

            $stats = $this->calculateStats(
                $periodStart,
                null,
                $prevPeriodStart,
                $periodStart,
                $rangeDays !== null,
                $currencyCode
            );

            $returnsSummary = $this->calculateReturnsSummaryLegacy($periodStart, $prevPeriodStart, $rangeDays);
            $salesOverTime = $this->calculateSalesOverTime($now, $rangeDays);
            $orderPipeline = $this->calculateOrderPipeline($periodStart);
            $topProducts = $this->calculateTopProducts($periodStart, null, $currencyCode);
            $salesByCategory = $this->calculateSalesByCategory($periodStart, null, $currencyCode);

            $rangeData = $range;
        }

        $recentOrders = $this->getRecentOrders($currencyCode);
        $recentActivity = $this->getRecentActivity();
        $trafficSources = $this->getTrafficSources();
        $goals = $this->getGoals($now);

        return response()->json([
            'data' => [
                'range' => $rangeData,
                'currency' => $currencyCode,
                'stats' => $stats,
                'returns_summary' => $returnsSummary,
                'sales_over_time' => $salesOverTime,
                'order_pipeline' => $orderPipeline,
                'top_products' => $topProducts,
                'sales_by_category' => $salesByCategory,
                'recent_orders' => $recentOrders,
                'recent_activity' => $recentActivity,
                'traffic_sources' => $trafficSources,
                'goals' => $goals,
            ],
        ]);
    }

    private function calculateStats(
        ?Carbon $periodStart,
        ?Carbon $periodEnd,
        ?Carbon $prevPeriodStart,
        ?Carbon $prevPeriodEnd,
        bool $hasComparison,
        string $currencyCode
    ): array {
        // Cancelled orders are excluded from total sales, order count, and AOV
        $salesQuery = Order::whereNotIn('status', ['cancelled'])
            ->when($periodStart && $periodEnd, fn ($query) => $query->whereBetween('created_at', [$periodStart, $periodEnd]))
            ->when($periodStart && ! $periodEnd, fn ($query) => $query->where('created_at', '>=', $periodStart));

        $salesRaw = (int) $salesQuery->sum('total');
        $salesDecimal = round($salesRaw / 100, 2);

        $salesPrevRaw = ($hasComparison && $prevPeriodStart && $prevPeriodEnd)
            ? (int) Order::whereNotIn('status', ['cancelled'])
                ->whereBetween('created_at', [$prevPeriodStart, $prevPeriodEnd])
                ->sum('total')
            : 0;

        $salesTrend = $salesPrevRaw > 0
            ? round((($salesRaw - $salesPrevRaw) / $salesPrevRaw) * 100, 1)
            : 0.0;

        $totalOrders = Order::whereNotIn('status', ['cancelled'])
            ->when($periodStart && $periodEnd, fn ($query) => $query->whereBetween('created_at', [$periodStart, $periodEnd]))
            ->when($periodStart && ! $periodEnd, fn ($query) => $query->where('created_at', '>=', $periodStart))
            ->count();

        $ordersPrev = ($hasComparison && $prevPeriodStart && $prevPeriodEnd)
            ? Order::whereNotIn('status', ['cancelled'])
                ->whereBetween('created_at', [$prevPeriodStart, $prevPeriodEnd])
                ->count()
            : 0;

        $ordersTrend = $ordersPrev > 0
            ? round((($totalOrders - $ordersPrev) / $ordersPrev) * 100, 1)
            : 0.0;

        $aovRaw = $totalOrders > 0 ? (int) round($salesRaw / $totalOrders) : 0;
        $aovDecimal = round($aovRaw / 100, 2);

        $aovPrevRaw = $ordersPrev > 0 ? (int) round($salesPrevRaw / $ordersPrev) : 0;
        $aovTrend = $aovPrevRaw > 0
            ? round((($aovRaw - $aovPrevRaw) / $aovPrevRaw) * 100, 1)
            : 0.0;

        return [
            'sales' => [
                'raw' => $salesRaw,
                'decimal' => $salesDecimal,
                'currency' => $currencyCode,
                'trend' => $salesTrend,
            ],
            'orders' => [
                'count' => $totalOrders,
                'trend' => $ordersTrend,
            ],
            'aov' => [
                'raw' => $aovRaw,
                'decimal' => $aovDecimal,
                'currency' => $currencyCode,
                'trend' => $aovTrend,
            ],
            'active_users' => [
                'value' => null,
                'status' => 'not_connected',
                'formatted' => '—',
            ],
        ];
    }

    private function calculateReturnsSummaryLegacy(?Carbon $periodStart, ?Carbon $prevPeriodStart, ?int $rangeDays): array
    {
        return $this->calculateReturnsSummaryForBounds(
            $periodStart,
            null,
            $prevPeriodStart,
            $periodStart,
            $rangeDays !== null
        );
    }

    private function calculateReturnsSummaryPreset(Carbon $periodStart, Carbon $periodEnd): array
    {
        $spanDays = (int) $periodStart->diffInDays($periodEnd) + 1;
        $prevPeriodStart = $periodStart->copy()->subDays($spanDays);
        $prevPeriodEnd = $periodStart;

        return $this->calculateReturnsSummaryForBounds(
            $periodStart,
            $periodEnd,
            $prevPeriodStart,
            $prevPeriodEnd,
            true
        );
    }

    private function calculateReturnsSummaryForBounds(
        ?Carbon $periodStart,
        ?Carbon $periodEnd,
        ?Carbon $prevPeriodStart,
        ?Carbon $prevPeriodEnd,
        bool $hasPreviousPeriod
    ): array {
        $totalOrders = Order::whereNotIn('status', ['cancelled'])
            ->when($periodStart && $periodEnd, fn ($query) => $query->whereBetween('created_at', [$periodStart, $periodEnd]))
            ->when($periodStart && ! $periodEnd, fn ($query) => $query->where('created_at', '>=', $periodStart))
            ->count();

        $ordersPrev = ($hasPreviousPeriod && $prevPeriodStart && $prevPeriodEnd)
            ? Order::whereNotIn('status', ['cancelled'])
                ->whereBetween('created_at', [$prevPeriodStart, $prevPeriodEnd])
                ->count()
            : 0;

        $refundedCount = OrderReturnRequest::whereIn('status', [
            OrderReturnRequest::STATUS_APPROVED,
            OrderReturnRequest::STATUS_COMPLETED,
        ])
            ->when($periodStart && $periodEnd, fn ($query) => $query->whereBetween('requested_at', [$periodStart, $periodEnd]))
            ->when($periodStart && ! $periodEnd, fn ($query) => $query->where('requested_at', '>=', $periodStart))
            ->count();

        $refundRate = $totalOrders > 0 ? round(($refundedCount / $totalOrders) * 100, 1) : 0.0;

        $refundedCountPrev = ($hasPreviousPeriod && $prevPeriodStart && $prevPeriodEnd)
            ? OrderReturnRequest::whereIn('status', [
                OrderReturnRequest::STATUS_APPROVED,
                OrderReturnRequest::STATUS_COMPLETED,
            ])
                ->whereBetween('requested_at', [$prevPeriodStart, $prevPeriodEnd])
                ->count()
            : 0;

        $refundRatePrev = $ordersPrev > 0 ? round(($refundedCountPrev / $ordersPrev) * 100, 1) : 0.0;
        $refundTrend = $refundRatePrev > 0
            ? round((($refundRate - $refundRatePrev) / $refundRatePrev) * 100, 1)
            : 0.0;

        $pendingReview = OrderReturnRequest::where('status', OrderReturnRequest::STATUS_REQUESTED)->count();

        $overdue = OrderReturnRequest::where('status', OrderReturnRequest::STATUS_REQUESTED)
            ->where('requested_at', '<', now()->subDays(OrderReturnRequest::PENDING_REVIEW_REMINDER_DAYS))
            ->count();

        $awaitingCompletion = OrderReturnRequest::where('status', OrderReturnRequest::STATUS_APPROVED)->count();

        return [
            'refund_rate' => $refundRate,
            'refund_trend' => $refundTrend,
            'pending_review' => $pendingReview,
            'overdue' => $overdue,
            'awaiting_completion' => $awaitingCompletion,
        ];
    }

    private function calculateSalesOverTimeForRange(Carbon $periodStart, Carbon $periodEnd, ?Carbon $compareStart = null): array
    {
        $categories = [];
        $revenueSeries = [];
        $ordersSeries = [];
        $revenueCompareSeries = $compareStart ? [] : null;
        $ordersCompareSeries = $compareStart ? [] : null;

        $spanDays = (int) $periodStart->copy()->startOfDay()->diffInDays($periodEnd->copy()->startOfDay()) + 1;

        if ($spanDays <= 90) {
            $granularity = 'day';
            $current = $periodStart->copy()->startOfDay();
            $endLimit = $periodEnd->copy()->startOfDay();
            $compareCurrent = $compareStart?->copy()->startOfDay();

            while ($current->lte($endLimit)) {
                $dayStart = $current->copy()->startOfDay();
                $dayEnd = $current->copy()->endOfDay();
                $categories[] = $dayStart->format('M j');

                $query = Order::whereNotIn('status', ['cancelled'])->whereBetween('created_at', [$dayStart, $dayEnd]);
                $revenueSeries[] = round(((int) (clone $query)->sum('total')) / 100, 2);
                $ordersSeries[] = (clone $query)->count();

                if ($compareCurrent) {
                    $compareDayStart = $compareCurrent->copy()->startOfDay();
                    $compareDayEnd = $compareCurrent->copy()->endOfDay();
                    $compareQuery = Order::whereNotIn('status', ['cancelled'])->whereBetween('created_at', [$compareDayStart, $compareDayEnd]);
                    $revenueCompareSeries[] = round(((int) (clone $compareQuery)->sum('total')) / 100, 2);
                    $ordersCompareSeries[] = (clone $compareQuery)->count();
                    $compareCurrent->addDay();
                }

                $current->addDay();
            }
        } else {
            $granularity = 'month';
            $currentMonth = $periodStart->copy()->startOfMonth();
            $endMonth = $periodEnd->copy()->startOfMonth();
            $compareCurrentMonth = $compareStart?->copy()->startOfMonth();

            while ($currentMonth->lte($endMonth)) {
                $monthStart = $currentMonth->copy()->startOfMonth();
                $monthEnd = $currentMonth->copy()->endOfMonth();
                $categories[] = $monthStart->format('M Y');

                $queryStart = $monthStart->lt($periodStart) ? $periodStart : $monthStart;
                $queryEnd = $monthEnd->gt($periodEnd) ? $periodEnd : $monthEnd;
                $query = Order::whereNotIn('status', ['cancelled'])->whereBetween('created_at', [$queryStart, $queryEnd]);
                $revenueSeries[] = round(((int) (clone $query)->sum('total')) / 100, 2);
                $ordersSeries[] = (clone $query)->count();

                if ($compareCurrentMonth) {
                    $compareMonthStart = $compareCurrentMonth->copy()->startOfMonth();
                    $compareMonthEnd = $compareCurrentMonth->copy()->endOfMonth();
                    $compareQuery = Order::whereNotIn('status', ['cancelled'])->whereBetween('created_at', [$compareMonthStart, $compareMonthEnd]);
                    $revenueCompareSeries[] = round(((int) (clone $compareQuery)->sum('total')) / 100, 2);
                    $ordersCompareSeries[] = (clone $compareQuery)->count();
                    $compareCurrentMonth->addMonthNoOverflow()->startOfMonth();
                }

                $currentMonth->addMonthNoOverflow()->startOfMonth();
            }
        }

        $series = ['revenue' => $revenueSeries, 'orders' => $ordersSeries];
        if ($revenueCompareSeries !== null) {
            $series['revenue_compare'] = $revenueCompareSeries;
            $series['orders_compare'] = $ordersCompareSeries;
        }

        return ['granularity' => $granularity, 'categories' => $categories, 'series' => $series];
    }

    private function calculateSalesOverTime(Carbon $now, ?int $rangeDays): array
    {
        $categories = [];
        $revenueSeries = [];
        $ordersSeries = [];
        $granularity = 'day';

        if ($rangeDays !== null && $rangeDays <= 90) {
            $granularity = 'day';
            for ($i = $rangeDays - 1; $i >= 0; $i--) {
                $dayStart = $now->copy()->subDays($i)->startOfDay();
                $dayEnd = $dayStart->copy()->endOfDay();
                $categories[] = $dayStart->format('M j');

                $query = Order::whereNotIn('status', ['cancelled'])
                    ->whereBetween('created_at', [$dayStart, $dayEnd]);

                $revenueCents = (int) (clone $query)->sum('total');
                $ordersCount = (clone $query)->count();

                $revenueSeries[] = round($revenueCents / 100, 2);
                $ordersSeries[] = $ordersCount;
            }
        } else {
            $granularity = 'month';
            $monthsBack = 11;

            if ($rangeDays === null) {
                $earliestOrder = Order::whereNotIn('status', ['cancelled'])->oldest('created_at')->value('created_at');
                if ($earliestOrder) {
                    $monthsBack = min(23, $now->diffInMonths(Carbon::parse($earliestOrder)));
                }
            }

            for ($i = $monthsBack; $i >= 0; $i--) {
                $monthStart = $now->copy()->subMonths($i)->startOfMonth();
                $monthEnd = $monthStart->copy()->endOfMonth();
                $categories[] = $monthStart->format('M Y');

                $query = Order::whereNotIn('status', ['cancelled'])
                    ->whereBetween('created_at', [$monthStart, $monthEnd]);

                $revenueCents = (int) (clone $query)->sum('total');
                $ordersCount = (clone $query)->count();

                $revenueSeries[] = round($revenueCents / 100, 2);
                $ordersSeries[] = $ordersCount;
            }
        }

        return [
            'granularity' => $granularity,
            'categories' => $categories,
            'series' => [
                'revenue' => $revenueSeries,
                'orders' => $ordersSeries,
            ],
        ];
    }

    private function calculateOrderPipeline(?Carbon $periodStart, ?Carbon $periodEnd = null): array
    {
        $statuses = ['awaiting-payment', 'processing', 'shipped', 'delivered'];
        $counts = [];

        foreach ($statuses as $status) {
            $key = str_replace('-', '_', $status);
            $counts[$key] = Order::where('status', $status)
                ->when($periodStart && $periodEnd, fn ($query) => $query->whereBetween('created_at', [$periodStart, $periodEnd]))
                ->when($periodStart && ! $periodEnd, fn ($query) => $query->where('created_at', '>=', $periodStart))
                ->count();
        }

        return $counts;
    }

    private function calculateTopProducts(?Carbon $periodStart, ?Carbon $periodEnd, string $currencyCode): array
    {
        $lines = OrderLine::query()
            ->where('type', 'physical')
            ->whereHas('order', function ($query) use ($periodStart, $periodEnd) {
                $query->whereNotIn('status', ['cancelled'])
                    ->when($periodStart && $periodEnd, fn ($q) => $q->whereBetween('created_at', [$periodStart, $periodEnd]))
                    ->when($periodStart && ! $periodEnd, fn ($q) => $q->where('created_at', '>=', $periodStart));
            })
            ->select(
                DB::raw('MAX(id) as id'),
                DB::raw('SUM(quantity) as quantity'),
                DB::raw('SUM(sub_total) as sub_total_sum'),
                DB::raw('MAX(description) as description'),
                'identifier'
            )
            ->groupBy('identifier', 'purchasable_id')
            ->orderByDesc('sub_total_sum')
            ->limit(5)
            ->get();

        return $lines->map(function ($line) use ($currencyCode) {
            $raw = (int) $line->sub_total_sum;

            return [
                'id' => (int) $line->id,
                'description' => (string) ($line->description ?: $line->identifier),
                'sku' => (string) $line->identifier,
                'quantity' => (int) $line->quantity,
                'revenue' => [
                    'raw' => $raw,
                    'decimal' => round($raw / 100, 2),
                    'currency' => $currencyCode,
                ],
            ];
        })->values()->all();
    }

    private function calculateSalesByCategory(?Carbon $periodStart, ?Carbon $periodEnd, string $currencyCode): array
    {
        $lines = OrderLine::query()
            ->where('type', 'physical')
            ->whereHas('order', function ($query) use ($periodStart, $periodEnd) {
                $query->whereNotIn('status', ['cancelled'])
                    ->when($periodStart && $periodEnd, fn ($q) => $q->whereBetween('created_at', [$periodStart, $periodEnd]))
                    ->when($periodStart && ! $periodEnd, fn ($q) => $q->where('created_at', '>=', $periodStart));
            })
            ->with(['purchasable.product.collections'])
            ->get();

        $totals = [];

        foreach ($lines as $line) {
            $product = $line->purchasable?->product;
            $collection = $product?->collections?->first();
            $categoryName = $collection ? ($collection->translateAttribute('name') ?: $collection->attribute('name') ?: 'Uncategorized') : 'Uncategorized';

            $rawCents = is_numeric($line->sub_total) ? (int) $line->sub_total : (int) ($line->sub_total?->value ?? 0);
            $totals[$categoryName] = ($totals[$categoryName] ?? 0) + $rawCents;
        }

        arsort($totals);
        $totals = array_slice($totals, 0, 6, true);

        $result = [];
        foreach ($totals as $category => $raw) {
            $result[] = [
                'name' => $category,
                'revenue' => [
                    'raw' => $raw,
                    'decimal' => round($raw / 100, 2),
                    'currency' => $currencyCode,
                ],
            ];
        }

        return $result;
    }

    private function getRecentOrders(string $currencyCode): array
    {
        $orders = Order::whereNotIn('status', ['cancelled'])
            ->with(['billingAddress'])
            ->orderByDesc('placed_at')
            ->orderByDesc('created_at')
            ->limit(6)
            ->get();

        return $orders->map(function ($order) use ($currencyCode) {
            $totalRaw = is_numeric($order->total) ? (int) $order->total : (int) ($order->total?->value ?? 0);
            $customerName = trim(($order->billingAddress?->first_name ?? '').' '.($order->billingAddress?->last_name ?? ''));
            if ($customerName === '') {
                $customerName = (string) ($order->customer?->name ?? 'Guest Customer');
            }

            return [
                'id' => (int) $order->id,
                'reference' => (string) ($order->reference ?: ('#'.$order->id)),
                'customer_name' => $customerName,
                'status' => (string) $order->status,
                'total' => [
                    'raw' => $totalRaw,
                    'decimal' => round($totalRaw / 100, 2),
                    'currency' => (string) ($order->currency_code ?: $currencyCode),
                ],
                'placed_at' => $order->placed_at?->toIso8601String(),
                'created_at' => $order->created_at?->toIso8601String(),
            ];
        })->values()->all();
    }

    private function getRecentActivity(): array
    {
        $events = collect();

        foreach (Order::whereNotNull('placed_at')->whereNotIn('status', ['cancelled'])->latest('placed_at')->limit(5)->get() as $order) {
            $events->push([
                'icon' => 'shopping-cart',
                'color' => '#df8448',
                'title' => 'Order Placed',
                'description' => "Order #{$order->reference} was placed",
                'at' => $order->placed_at?->toIso8601String(),
            ]);
        }

        $customers = (function () {
            try {
                return User::role('customer')->latest()->limit(5)->get();
            } catch (RoleDoesNotExist) {
                return User::latest()->limit(5)->get();
            }
        })();

        foreach ($customers as $customer) {
            $events->push([
                'icon' => 'user-plus',
                'color' => '#38c68b',
                'title' => 'Customer Registered',
                'description' => "{$customer->name} registered an account",
                'at' => $customer->created_at?->toIso8601String(),
            ]);
        }

        foreach (Review::latest()->limit(5)->get() as $review) {
            $events->push([
                'icon' => 'star',
                'color' => '#f5a623',
                'title' => 'Review Received',
                'description' => "{$review->rating}-star review received from {$review->customer_name}",
                'at' => $review->created_at?->toIso8601String(),
            ]);
        }

        return $events
            ->filter(fn ($event) => $event['at'] !== null)
            ->sortByDesc('at')
            ->take(6)
            ->values()
            ->all();
    }

    private function getTrafficSources(): array
    {
        return [
            'status' => 'not_connected',
            'items' => [
                ['label' => 'Direct', 'percent' => null, 'color' => '#df8448'],
                ['label' => 'Organic', 'percent' => null, 'color' => '#0d9488'],
                ['label' => 'Social', 'percent' => null, 'color' => '#f59e0b'],
                ['label' => 'Referral', 'percent' => null, 'color' => '#3e4c57'],
            ],
        ];
    }

    private function getGoals(Carbon $now): array
    {
        $monthStart = $now->copy()->startOfMonth();

        $revenueActual = round((int) Order::whereNotIn('status', ['cancelled'])
            ->where('created_at', '>=', $monthStart)
            ->sum('total') / 100, 2);

        $ordersActual = Order::whereNotIn('status', ['cancelled'])
            ->where('created_at', '>=', $monthStart)
            ->count();

        $newCustomersActual = (function () use ($monthStart) {
            try {
                return User::role('customer')->where('created_at', '>=', $monthStart)->count();
            } catch (RoleDoesNotExist) {
                return User::where('created_at', '>=', $monthStart)->count();
            }
        })();

        $revenueTargetSetting = Setting::where('key', 'monthly_revenue_target')->first();
        $ordersTargetSetting = Setting::where('key', 'monthly_orders_target')->first();
        $newCustomersTargetSetting = Setting::where('key', 'monthly_new_customers_target')->first();

        $goals = [
            [
                'key' => 'monthly_revenue_target',
                'label' => 'Revenue',
                'actual' => $revenueActual,
                'target' => $revenueTargetSetting ? (float) $revenueTargetSetting->cast_value : null,
                'unit' => 'currency',
            ],
            [
                'key' => 'monthly_orders_target',
                'label' => 'Orders',
                'actual' => $ordersActual,
                'target' => $ordersTargetSetting ? (int) $ordersTargetSetting->cast_value : null,
                'unit' => 'number',
            ],
            [
                'key' => 'monthly_new_customers_target',
                'label' => 'New Customers',
                'actual' => $newCustomersActual,
                'target' => $newCustomersTargetSetting ? (int) $newCustomersTargetSetting->cast_value : null,
                'unit' => 'number',
            ],
        ];

        foreach ($goals as &$goal) {
            if ($goal['target'] !== null && $goal['target'] > 0) {
                $uncapped = round(($goal['actual'] / $goal['target']) * 100, 1);
                $goal['uncapped_percent'] = $uncapped;
                $goal['percent'] = min(100, (int) round($uncapped));
            } else {
                $goal['uncapped_percent'] = null;
                $goal['percent'] = null;
            }
        }

        return $goals;
    }
}
