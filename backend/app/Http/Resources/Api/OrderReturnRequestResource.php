<?php

namespace App\Http\Resources\Api;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrderReturnRequestResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'order_reference' => $this->order?->reference,
            'status' => $this->status,
            'reason' => $this->reason,
            'customer_note' => $this->customer_note,
            'admin_note' => $this->admin_note,
            'rma_address' => $this->rma_address,
            'return_tracking_number' => $this->return_tracking_number,
            'return_carrier' => $this->return_carrier,
            'return_tracking_url' => $this->return_tracking_url,
            'low_value_auto_waive_eligible' => ($this->meta['low_value_auto_waive_eligible'] ?? false) === true,
            'refund_amount' => $this->refund_amount_minor !== null ? $this->refund_amount_minor / 100 : null,
            'restocking_fee' => $this->restocking_fee_minor !== null ? $this->restocking_fee_minor / 100 : null,
            'fee_waived' => (bool) $this->fee_waived,
            'requested_at' => $this->requested_at?->toIso8601String(),
            'approved_at' => $this->approved_at?->toIso8601String(),
            'rejected_at' => $this->rejected_at?->toIso8601String(),
            'completed_at' => $this->completed_at?->toIso8601String(),
            'items' => $this->items->map(fn ($item) => [
                'order_line_id' => (string) $item->order_line_id,
                'description' => $item->orderLine?->description,
                'option' => $item->orderLine?->option,
                'quantity' => $item->quantity,
            ]),
        ];
    }
}
