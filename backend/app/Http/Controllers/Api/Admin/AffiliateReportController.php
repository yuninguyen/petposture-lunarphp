<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AffiliateClick;
use App\Models\AffiliateReport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class AffiliateReportController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'range' => ['nullable', 'string', 'in:7,30,90,all,custom'],
            'date_from' => ['required_if:range,custom', 'nullable', 'date'],
            'date_to' => ['required_if:range,custom', 'nullable', 'date', 'after_or_equal:date_from'],
        ]);

        $range = $request->input('range', '30');
        if (! in_array($range, ['7', '30', '90', 'all', 'custom'], true)) {
            $range = '30';
        }

        if ($range === 'custom') {
            $startDate = Carbon::parse($request->input('date_from'))->startOfDay();
            $endDate = Carbon::parse($request->input('date_to'))->endOfDay();
        } else {
            $startDate = match ($range) {
                '7' => Carbon::now()->subDays(7),
                '30' => Carbon::now()->subDays(30),
                '90' => Carbon::now()->subDays(90),
                default => null,
            };
            $endDate = $range === 'all' ? null : Carbon::now();
        }

        $dateFrom = $startDate?->toDateString();
        $dateTo = $endDate?->toDateString();

        // 1. Overview stats
        $now = Carbon::now();
        $clicks7d = AffiliateClick::where('created_at', '>=', $now->copy()->subDays(7))->count();
        $clicks30d = AffiliateClick::where('created_at', '>=', $now->copy()->subDays(30))->count();
        $clicksAllTime = AffiliateClick::count();

        $topNetworkClick = AffiliateClick::query()
            ->selectRaw('affiliate_network_id, count(*) as total')
            ->whereNotNull('affiliate_network_id')
            ->where('created_at', '>=', $now->copy()->subDays(30))
            ->groupBy('affiliate_network_id')
            ->orderByDesc('total')
            ->with('network')
            ->first();

        $reportQuery = AffiliateReport::query()
            ->when($startDate, fn ($q) => $q->where('date', '>=', $startDate->toDateString()))
            ->when($endDate, fn ($q) => $q->where('date', '<=', $endDate->toDateString()));

        $hasSyncedData = (clone $reportQuery)->exists();
        $conversionsSynced = $hasSyncedData ? (int) (clone $reportQuery)->sum('conversions') : null;
        $commissionAmountSynced = $hasSyncedData ? (float) (clone $reportQuery)->sum('commission_amount') : null;

        // 2. Top Networks in range
        $byNetwork = AffiliateClick::query()
            ->selectRaw('affiliate_network_id, count(*) as total')
            ->when($startDate, fn ($q) => $q->where('created_at', '>=', $startDate))
            ->when($endDate, fn ($q) => $q->where('created_at', '<=', $endDate))
            ->groupBy('affiliate_network_id')
            ->orderByDesc('total')
            ->with('network')
            ->limit(10)
            ->get()
            ->map(function ($item) use ($startDate, $endDate) {
                $network = $item->network;

                $netReportQuery = AffiliateReport::query()
                    ->where('affiliate_network_id', $item->affiliate_network_id)
                    ->when($startDate, fn ($q) => $q->where('date', '>=', $startDate->toDateString()))
                    ->when($endDate, fn ($q) => $q->where('date', '<=', $endDate->toDateString()));

                $hasNetworkSynced = $netReportQuery->exists();

                return [
                    'network_id' => $item->affiliate_network_id,
                    'network_name' => $network?->name ?? '(unknown)',
                    'network_slug' => $network?->slug,
                    'clicks' => (int) $item->total,
                    'is_configured' => $network ? $network->isApiConfigured() : false,
                    'last_synced_at' => $network?->last_synced_at?->toISOString(),
                    'synced_conversions' => $hasNetworkSynced ? (int) (clone $netReportQuery)->sum('conversions') : null,
                    'synced_commission' => $hasNetworkSynced ? (float) (clone $netReportQuery)->sum('commission_amount') : null,
                ];
            });

        // 3. Top Clicked Posts in range
        $byPost = AffiliateClick::query()
            ->selectRaw('max(id) as id, post_id, count(*) as total')
            ->when($startDate, fn ($q) => $q->where('created_at', '>=', $startDate))
            ->when($endDate, fn ($q) => $q->where('created_at', '<=', $endDate))
            ->groupBy('post_id')
            ->orderByDesc('total')
            ->with('post:id,title,slug')
            ->limit(10)
            ->get()
            ->map(fn ($item) => [
                'post_id' => $item->post_id,
                'post_title' => $item->post?->title ?? '(deleted post)',
                'clicks' => (int) $item->total,
            ]);

        return response()->json([
            'range' => $range,
            'date_from' => $dateFrom,
            'date_to' => $dateTo,
            'overview' => [
                'clicks_7d' => $clicks7d,
                'clicks_30d' => $clicks30d,
                'clicks_all_time' => $clicksAllTime,
                'top_network_30d' => $topNetworkClick ? [
                    'name' => $topNetworkClick->network?->name ?? '(unknown)',
                    'clicks' => (int) $topNetworkClick->total,
                ] : null,
                'conversions_synced' => $conversionsSynced,
                'commission_amount_synced' => $commissionAmountSynced,
                'has_synced_data' => $hasSyncedData,
            ],
            'by_network' => $byNetwork,
            'by_post' => $byPost,
        ]);
    }
}
