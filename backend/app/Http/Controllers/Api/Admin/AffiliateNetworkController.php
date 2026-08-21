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
            ->get(['name', 'slug']);

        return response()->json($networks);
    }
}
