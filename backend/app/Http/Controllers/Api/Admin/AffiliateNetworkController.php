<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AffiliateNetwork;
use Illuminate\Http\JsonResponse;

class AffiliateNetworkController extends Controller
{
    public function index(): JsonResponse
    {
        $networks = AffiliateNetwork::where('active', true)
            ->orderBy('name')
            // id and logo are what the Pick form needs to offer a store with its logo; keys and secrets stay out.
            ->get(['id', 'name', 'slug', 'logo']);

        return response()->json($networks);
    }
}
