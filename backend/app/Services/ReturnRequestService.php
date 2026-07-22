<?php

namespace App\Services;

use App\Mail\OrderReturnApproved;
use App\Mail\OrderReturnRejected;
use App\Mail\OrderReturnRequested;
use App\Models\OrderReturnRequest;
use App\Models\OrderReturnRequestItem;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;
use Lunar\Models\Order;

class ReturnRequestService
{
    public function __construct(
        private readonly OrderOperationsService $orderOperations,
        private readonly OrderEventService $orderEventService,
    ) {
    }

    /**
     * @param array<int, array{order_line_id: int, quantity: int}> $items
     */
    public function create(Order $order, array $items, string $reason, ?string $customerNote): OrderReturnRequest
    {
        if (! in_array((string) $order->status, ['delivered', 'shipped'], true)) {
            throw ValidationException::withMessages([
                'order' => ['Only delivered or shipped orders are eligible for a return request.'],
            ]);
        }

        $hasActiveRequest = OrderReturnRequest::query()
            ->where('order_id', $order->id)
            ->whereIn('status', [OrderReturnRequest::STATUS_REQUESTED, OrderReturnRequest::STATUS_APPROVED])
            ->exists();

        if ($hasActiveRequest) {
            throw ValidationException::withMessages([
                'order' => ['A return request for this order is already in progress.'],
            ]);
        }

        if (empty($items)) {
            throw ValidationException::withMessages([
                'items' => ['Select at least one item to return.'],
            ]);
        }

        $returnRequest = OrderReturnRequest::create([
            'order_id' => $order->id,
            'status' => OrderReturnRequest::STATUS_REQUESTED,
            'reason' => $reason,
            'customer_note' => $customerNote,
            'requested_at' => now(),
        ]);

        foreach ($items as $item) {
            OrderReturnRequestItem::create([
                'return_request_id' => $returnRequest->id,
                'order_line_id' => $item['order_line_id'],
                'quantity' => $item['quantity'],
            ]);
        }

        $this->orderEventService->record(
            $order,
            'return_request.requested',
            'Return requested',
            "Customer requested a return (reason: {$reason})."
        );

        if ($order->customer_reference) {
            Mail::to($order->customer_reference)->send(new OrderReturnRequested($returnRequest));
        }

        return $returnRequest->refresh()->loadMissing(['order', 'items.orderLine']);
    }

    public function approve(OrderReturnRequest $returnRequest, string $rmaAddress, ?int $refundAmountMinor, ?string $adminNote): OrderReturnRequest
    {
        $this->guardStatus($returnRequest, OrderReturnRequest::STATUS_REQUESTED);

        $returnRequest->update([
            'status' => OrderReturnRequest::STATUS_APPROVED,
            'rma_address' => $rmaAddress,
            'refund_amount_minor' => $refundAmountMinor,
            'admin_note' => $adminNote,
            'approved_at' => now(),
        ]);

        $this->orderEventService->record(
            $returnRequest->order,
            'return_request.approved',
            'Return request approved',
            'Admin approved the return request and sent RMA instructions.'
        );

        if ($returnRequest->order->customer_reference) {
            Mail::to($returnRequest->order->customer_reference)->send(new OrderReturnApproved($returnRequest));
        }

        return $returnRequest->refresh()->loadMissing(['order', 'items.orderLine']);
    }

    public function reject(OrderReturnRequest $returnRequest, ?string $adminNote): OrderReturnRequest
    {
        $this->guardStatus($returnRequest, OrderReturnRequest::STATUS_REQUESTED);

        $returnRequest->update([
            'status' => OrderReturnRequest::STATUS_REJECTED,
            'admin_note' => $adminNote,
            'rejected_at' => now(),
        ]);

        $this->orderEventService->record(
            $returnRequest->order,
            'return_request.rejected',
            'Return request rejected',
            $adminNote ?: 'Admin rejected the return request.'
        );

        if ($returnRequest->order->customer_reference) {
            Mail::to($returnRequest->order->customer_reference)->send(new OrderReturnRejected($returnRequest));
        }

        return $returnRequest->refresh()->loadMissing(['order', 'items.orderLine']);
    }

    public function complete(OrderReturnRequest $returnRequest): OrderReturnRequest
    {
        $this->guardStatus($returnRequest, OrderReturnRequest::STATUS_APPROVED);

        $returnRequest->update([
            'status' => OrderReturnRequest::STATUS_COMPLETED,
            'completed_at' => now(),
        ]);

        // Reuses the existing "Mark Returned" flow (meta['fulfillment_status'],
        // OrderReturned email) so both entry points stay in sync.
        $this->orderOperations->returnOrder($returnRequest->order);

        return $returnRequest->refresh()->loadMissing(['order', 'items.orderLine']);
    }

    private function guardStatus(OrderReturnRequest $returnRequest, string $expected): void
    {
        if ($returnRequest->status !== $expected) {
            throw ValidationException::withMessages([
                'status' => ["Return request must be in '{$expected}' status for this action (currently '{$returnRequest->status}')."],
            ]);
        }
    }
}
