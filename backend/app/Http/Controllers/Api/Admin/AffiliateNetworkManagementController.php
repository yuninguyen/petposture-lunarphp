<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\SyncAffiliateReportJob;
use App\Models\AffiliateNetwork;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AffiliateNetworkManagementController extends Controller
{
    public function index(): JsonResponse
    {
        $networks = AffiliateNetwork::query()
            ->orderBy('name')
            ->get()
            ->map(fn (AffiliateNetwork $network) => $this->formatNetwork($network));

        return response()->json([
            'data' => $networks,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255', 'unique:affiliate_networks,slug'],
            'logo' => ['nullable', 'string', 'max:500'],
            'active' => ['boolean'],
            'provider' => ['nullable', 'string', 'max:100'],
            'api_key' => ['nullable', 'string'],
            'api_secret' => ['nullable', 'string'],
            'merchant_id' => ['nullable', 'string', 'max:255'],
            'commission_rate_default' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'cookie_days' => ['nullable', 'integer', 'min:0'],
        ]);

        $slug = ! empty($validated['slug']) ? Str::slug($validated['slug']) : Str::slug($validated['name']);

        $network = AffiliateNetwork::create([
            'name' => $validated['name'],
            'slug' => $slug,
            'logo' => $validated['logo'] ?? null,
            'active' => $request->boolean('active', true),
            'provider' => $validated['provider'] ?? null,
            'api_key' => $validated['api_key'] ?? null,
            'api_secret' => $validated['api_secret'] ?? null,
            'merchant_id' => $validated['merchant_id'] ?? null,
            'commission_rate_default' => $validated['commission_rate_default'] ?? null,
            'cookie_days' => $validated['cookie_days'] ?? null,
        ]);

        return response()->json([
            'data' => $this->formatNetwork($network),
        ], 201);
    }

    public function show(int $id): JsonResponse
    {
        $network = AffiliateNetwork::findOrFail($id);

        return response()->json([
            'data' => $this->formatNetwork($network),
        ]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $network = AffiliateNetwork::findOrFail($id);

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'slug' => ['sometimes', 'required', 'string', 'max:255', Rule::unique('affiliate_networks', 'slug')->ignore($network->id)],
            'logo' => ['nullable', 'string', 'max:500'],
            'active' => ['boolean'],
            'provider' => ['nullable', 'string', 'max:100'],
            'api_key' => ['nullable', 'string'],
            'api_secret' => ['nullable', 'string'],
            'merchant_id' => ['nullable', 'string', 'max:255'],
            'commission_rate_default' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'cookie_days' => ['nullable', 'integer', 'min:0'],
        ]);

        if ($request->has('name')) {
            $network->name = $validated['name'];
        }
        if ($request->has('slug')) {
            $network->slug = Str::slug($validated['slug']);
        }
        if ($request->has('logo')) {
            $network->logo = $validated['logo'];
        }
        if ($request->has('active')) {
            $network->active = $request->boolean('active');
        }
        if ($request->has('provider')) {
            $network->provider = $validated['provider'];
        }
        if ($request->has('merchant_id')) {
            $network->merchant_id = $validated['merchant_id'];
        }
        if ($request->has('commission_rate_default')) {
            $network->commission_rate_default = $validated['commission_rate_default'];
        }
        if ($request->has('cookie_days')) {
            $network->cookie_days = $validated['cookie_days'];
        }

        // Omission preserves secret: only overwrite if present in request payload
        if ($request->has('api_key')) {
            $network->api_key = $validated['api_key'];
        }
        if ($request->has('api_secret')) {
            $network->api_secret = $validated['api_secret'];
        }

        $network->save();

        return response()->json([
            'data' => $this->formatNetwork($network),
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $network = AffiliateNetwork::findOrFail($id);
        $network->delete();

        return response()->json([
            'message' => 'Affiliate network deleted successfully.',
        ]);
    }

    public function sync(int $id): JsonResponse
    {
        $network = AffiliateNetwork::findOrFail($id);

        if (! $network->isApiConfigured()) {
            return response()->json([
                'message' => 'Affiliate network API is not configured.',
            ], 422);
        }

        SyncAffiliateReportJob::dispatch($network->id);

        return response()->json([
            'message' => 'Sync triggered successfully for '.$network->name,
        ], 202);
    }

    /**
     * Format network model for API response.
     * ZERO CREDENTIAL EXPOSURE: api_key and api_secret are NEVER exposed in any form.
     */
    protected function formatNetwork(AffiliateNetwork $network): array
    {
        return [
            'id' => $network->id,
            'name' => $network->name,
            'slug' => $network->slug,
            'logo' => $network->logo,
            'active' => (bool) $network->active,
            'provider' => $network->provider,
            'merchant_id' => $network->merchant_id,
            'commission_rate_default' => $network->commission_rate_default !== null ? (float) $network->commission_rate_default : null,
            'cookie_days' => $network->cookie_days !== null ? (int) $network->cookie_days : null,
            'is_configured' => $network->isApiConfigured(),
            'last_synced_at' => $network->last_synced_at?->toISOString(),
            'created_at' => $network->created_at?->toISOString(),
            'updated_at' => $network->updated_at?->toISOString(),
        ];
    }
}
