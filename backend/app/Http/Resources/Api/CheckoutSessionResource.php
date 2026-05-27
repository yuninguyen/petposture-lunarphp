<?php

namespace App\Http\Resources\Api;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CheckoutSessionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'token' => $this->token,
            'status' => $this->status,
            'currency' => $this->currency,
            'payload' => $this->payload ?? [],
            'totals' => $this->totals ?? [],
            'payment_intent_id' => $this->payment_intent_id,
            'payment_client_secret' => $this->payment_client_secret,
            'order_reference' => $this->order_reference,
            'expires_at' => optional($this->expires_at)?->toIso8601String(),
            'updated_at' => optional($this->updated_at)?->toIso8601String(),
        ];
    }
}
