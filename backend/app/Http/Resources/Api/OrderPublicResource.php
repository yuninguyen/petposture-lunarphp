<?php

namespace App\Http\Resources\Api;

use Illuminate\Http\Request;

class OrderPublicResource extends OrderResource
{
    /**
     * Same shape as OrderResource, minus fields that have no legitimate use on a
     * publicly-reachable, tracking_number+email-gated endpoint (/orders/track,
     * /orders/retry-payment) — staff-only notes, internal gateway/refund
     * bookkeeping, the audit trail, and admin-only available actions.
     */
    public function toArray(Request $request): array
    {
        $data = parent::toArray($request);

        unset(
            $data['internal_note'],
            $data['payment_intent_id'],
            $data['payment_gateway'],
            $data['payment_collection'],
            $data['payment_last_event_type'],
            $data['refund_status'],
            $data['refund_id'],
            $data['refund_amount'],
            $data['refunded_at'],
            $data['returned_at'],
            $data['order_events'],
            $data['available_actions'],
            $data['tax_provider'],
            $data['tax_provider_requested'],
            $data['tax_provider_fallback_applied'],
            $data['tax_provider_fallback'],
            $data['tax_provider_fallback_reason'],
        );

        return $data;
    }
}
