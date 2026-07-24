<?php

namespace App\Services;

use App\Mail\OrderReturnApproved;
use App\Mail\OrderReturnRejected;
use App\Mail\OrderReturnRequested;
use App\Models\OrderReturnRequest;
use App\Models\OrderReturnRequestItem;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;
use Lunar\Models\Order;

class ReturnRequestService
{
    private const RETURN_WINDOW_DAYS = 30;

    private const RESTOCKING_FEE_PERCENT = 25;

    public function __construct(
        private readonly OrderOperationsService $orderOperations,
        private readonly OrderEventService $orderEventService,
    ) {}

    /**
     * @param  array<int, array{order_line_id: int, quantity: int}>  $items
     */
    public function create(Order $order, array $items, string $reason, ?string $customerNote): OrderReturnRequest
    {
        if (! in_array((string) $order->status, ['delivered', 'shipped'], true)) {
            throw ValidationException::withMessages([
                'order' => ['Only delivered or shipped orders are eligible for a return request.'],
            ]);
        }

        $deliveredAt = (array_key_exists('delivered_at', (array) ($order->meta ?? [])))
            ? ($order->meta['delivered_at'] ?? null)
            : null;

        if ($order->status === 'delivered' && $deliveredAt) {
            $deadline = Carbon::parse($deliveredAt)->addDays(self::RETURN_WINDOW_DAYS);

            if (now()->greaterThan($deadline)) {
                throw ValidationException::withMessages([
                    'order' => ['This order is outside our '.self::RETURN_WINDOW_DAYS.'-day return window.'],
                ]);
            }
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

        $quantityByLine = [];
        foreach ($items as $item) {
            $quantityByLine[$item['order_line_id']] = ($quantityByLine[$item['order_line_id']] ?? 0) + $item['quantity'];
        }

        // Quantity already consumed by a prior completed return request for this order,
        // per line — the active-request check above only rules out a concurrent
        // requested/approved one, so a line that was already fully returned in a past
        // completed request would otherwise be returnable again.
        $alreadyReturnedByLine = OrderReturnRequestItem::query()
            ->whereHas('returnRequest', fn ($query) => $query
                ->where('order_id', $order->id)
                ->where('status', OrderReturnRequest::STATUS_COMPLETED))
            ->selectRaw('order_line_id, SUM(quantity) as total_quantity')
            ->groupBy('order_line_id')
            ->pluck('total_quantity', 'order_line_id');

        foreach ($quantityByLine as $orderLineId => $totalQuantity) {
            $line = $order->lines->firstWhere('id', $orderLineId);

            if (! $line) {
                throw ValidationException::withMessages([
                    'items' => ["Order line {$orderLineId} does not belong to this order."],
                ]);
            }

            $alreadyReturned = (int) ($alreadyReturnedByLine[$orderLineId] ?? 0);

            if ($alreadyReturned + $totalQuantity > $line->quantity) {
                throw ValidationException::withMessages([
                    'items' => ["Cannot return more than the purchased quantity for order line {$orderLineId}."],
                ]);
            }
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

    /**
     * Preview the refund estimate for items on an order before a return request exists yet
     * (guest-facing form). Silently skips items that don't belong to the order or exceed the
     * purchased quantity — validation of those is store()'s job at actual submission time.
     *
     * @param  array<int, array{order_line_id: int, quantity: int}>  $items
     * @return array{item_subtotal_minor: int, tax_minor: int, restocking_fee_minor: int, refund_amount_minor: int}
     */
    public function previewRefundEstimate(Order $order, array $items): array
    {
        $itemSubtotalMinor = 0;
        $taxMinor = 0;

        foreach ($items as $item) {
            $line = $order->lines->firstWhere('id', $item['order_line_id'] ?? null);
            $quantity = (int) ($item['quantity'] ?? 0);

            if (! $line || $line->quantity <= 0 || $quantity <= 0) {
                continue;
            }

            $ratio = min($quantity, $line->quantity) / $line->quantity;
            $itemSubtotalMinor += (int) round($this->moneyToMinor($line->sub_total) * $ratio);
            $taxMinor += (int) round($this->moneyToMinor($line->tax_total) * $ratio);
        }

        $restockingFeeMinor = (int) round($itemSubtotalMinor * self::RESTOCKING_FEE_PERCENT / 100);
        $refundAmountMinor = max(0, $itemSubtotalMinor + $taxMinor - $restockingFeeMinor);

        return [
            'item_subtotal_minor' => $itemSubtotalMinor,
            'tax_minor' => $taxMinor,
            'restocking_fee_minor' => $restockingFeeMinor,
            'refund_amount_minor' => $refundAmountMinor,
        ];
    }

    /**
     * @return array{item_subtotal_minor: int, tax_minor: int, restocking_fee_minor: int, refund_amount_minor: int}
     */
    public function calculateRefundEstimate(OrderReturnRequest $returnRequest, bool $feeWaived): array
    {
        $itemSubtotalMinor = 0;
        $taxMinor = 0;

        foreach ($returnRequest->items()->with('orderLine')->get() as $item) {
            $line = $item->orderLine;

            if (! $line || $line->quantity <= 0) {
                continue;
            }

            $ratio = $item->quantity / $line->quantity;
            $itemSubtotalMinor += (int) round($this->moneyToMinor($line->sub_total) * $ratio);
            $taxMinor += (int) round($this->moneyToMinor($line->tax_total) * $ratio);
        }

        $restockingFeeMinor = $feeWaived ? 0 : (int) round($itemSubtotalMinor * self::RESTOCKING_FEE_PERCENT / 100);
        $refundAmountMinor = max(0, $itemSubtotalMinor + $taxMinor - $restockingFeeMinor);

        return [
            'item_subtotal_minor' => $itemSubtotalMinor,
            'tax_minor' => $taxMinor,
            'restocking_fee_minor' => $restockingFeeMinor,
            'refund_amount_minor' => $refundAmountMinor,
        ];
    }

    public function approve(OrderReturnRequest $returnRequest, string $rmaAddress, bool $feeWaived, ?int $refundAmountMinorOverride, ?string $adminNote): OrderReturnRequest
    {
        $this->guardStatus($returnRequest, OrderReturnRequest::STATUS_REQUESTED);

        $estimate = $this->calculateRefundEstimate($returnRequest, $feeWaived);

        $refundAmountMinor = $refundAmountMinorOverride ?? $estimate['refund_amount_minor'];

        // When the admin overrides the amount, record the fee actually implied by that
        // override (subtotal + tax - refund) rather than the frozen 25% suggestion, so
        // restocking_fee_minor always reconciles with refund_amount_minor later.
        $restockingFeeMinor = $refundAmountMinorOverride !== null
            ? max(0, $estimate['item_subtotal_minor'] + $estimate['tax_minor'] - $refundAmountMinorOverride)
            : $estimate['restocking_fee_minor'];

        $returnRequest->update([
            'status' => OrderReturnRequest::STATUS_APPROVED,
            'rma_address' => $rmaAddress,
            'refund_amount_minor' => $refundAmountMinor,
            'restocking_fee_minor' => $restockingFeeMinor,
            'fee_waived' => $feeWaived,
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

    public function addTracking(OrderReturnRequest $returnRequest, string $trackingNumber, ?string $carrier): OrderReturnRequest
    {
        $this->guardStatus($returnRequest, OrderReturnRequest::STATUS_APPROVED);

        $carrier = $carrier ?: 'manual';
        $trackingUrls = [
            'ups' => 'https://www.ups.com/track?tracknum=' . urlencode($trackingNumber),
            'usps' => 'https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=' . urlencode($trackingNumber),
            'fedex' => 'https://www.fedex.com/fedextrack/?trknbr=' . urlencode($trackingNumber),
            'dhl' => 'https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=' . urlencode($trackingNumber),
        ];

        $returnRequest->update([
            'return_tracking_number' => $trackingNumber,
            'return_carrier' => $carrier,
            'return_tracking_url' => $trackingUrls[$carrier] ?? null,
        ]);

        $this->orderEventService->record(
            $returnRequest->order,
            'return_request.tracking_added',
            'Return tracking added',
            "Customer's return shipment tracking: {$trackingNumber} (" . strtoupper($carrier) . ')'
        );

        return $returnRequest->refresh();
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

    private function moneyToMinor(mixed $amount): int
    {
        if (is_object($amount) && property_exists($amount, 'value')) {
            return (int) $amount->value;
        }

        return is_numeric($amount) ? (int) $amount : 0;
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
