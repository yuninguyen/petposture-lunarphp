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
            'refund_amount' => $this->refund_amount_minor !== null ? $this->refund_amount_minor / 100 : null,
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
