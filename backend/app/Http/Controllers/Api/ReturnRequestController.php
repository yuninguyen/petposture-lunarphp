<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\OrderReturnRequestResource;
use App\Models\OrderReturnRequest;
use App\Services\OrderTrackingAccessService;
use App\Services\ReturnRequestService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class ReturnRequestController extends Controller
{
    public function __construct(
        private readonly ReturnRequestService $returnRequestService,
        private readonly OrderTrackingAccessService $orderTrackingAccessService,
    ) {}

    /**
     * Submit a new return request using the private tracking token and email.
     */
    public function store(Request $request)
    {
        $validated = Validator::make($request->all(), [
            'tracking_token' => 'required|string|max:255',
            'email' => 'required|email',
            'reason' => 'required|string|max:160',
            'note' => 'nullable|string|max:2000',
            'items' => 'required|array|min:1',
            'items.*.order_line_id' => 'required|integer',
            'items.*.quantity' => 'required|integer|min:1',
        ])->validate();

        $order = $this->orderTrackingAccessService->find(
            trim((string) $validated['tracking_token']),
            trim((string) $validated['email']),
        )?->loadMissing(['lines', 'billingAddress']);

        if (! $order) {
            return response()->json(['message' => 'Unable to access this order.'], 404);
        }

        try {
            $returnRequest = $this->returnRequestService->create(
                $order,
                $validated['items'],
                $validated['reason'],
                $validated['note'] ?? null,
            );
        } catch (ValidationException $e) {
            return response()->json(['message' => $e->getMessage(), 'errors' => $e->errors()], 422);
        }

        return new OrderReturnRequestResource($returnRequest);
    }

    public function options(Request $request)
    {
        $validated = Validator::make($request->all(), [
            'tracking_token' => 'required|string|max:255',
            'email' => 'required|email',
        ])->validate();

        $order = $this->orderTrackingAccessService->find(
            trim((string) $validated['tracking_token']),
            trim((string) $validated['email']),
        )?->loadMissing('lines');

        if (! $order) {
            return response()->json(['message' => 'Unable to access this order.'], 404);
        }

        return response()->json([
            'data' => [
                'reference' => $order->reference,
                'status' => $order->status,
                'delivered_at' => $order->meta['delivered_at'] ?? null,
                'lines' => $order->lines
                    ->where('type', '!=', 'shipping')
                    ->map(fn ($line): array => [
                        'id' => (string) $line->id,
                        'type' => $line->type,
                        'description' => $line->description,
                        'quantity' => (int) $line->quantity,
                        'image' => null,
                    ])->values(),
            ],
        ]);
    }

    /**
     * Preview the refund estimate for selected items before submitting (guest, no side effects).
     */
    public function preview(Request $request)
    {
        $validated = Validator::make($request->all(), [
            'tracking_token' => 'required|string|max:255',
            'email' => 'required|email',
            'items' => 'required|array|min:1',
            'items.*.order_line_id' => 'required|integer',
            'items.*.quantity' => 'required|integer|min:1',
        ])->validate();

        $order = $this->orderTrackingAccessService->find(
            trim((string) $validated['tracking_token']),
            trim((string) $validated['email']),
        )?->loadMissing(['lines', 'billingAddress']);

        if (! $order) {
            return response()->json(['message' => 'Unable to access this order.'], 404);
        }

        $estimate = $this->returnRequestService->previewRefundEstimate($order, $validated['items']);

        return response()->json([
            'item_subtotal' => $estimate['item_subtotal_minor'] / 100,
            'tax' => $estimate['tax_minor'] / 100,
            'restocking_fee' => $estimate['restocking_fee_minor'] / 100,
            'estimated_refund' => $estimate['refund_amount_minor'] / 100,
        ]);
    }

    /**
     * List return requests (Admin).
     */
    public function index(Request $request)
    {
        if (! $this->canManageOrders($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $query = OrderReturnRequest::with(['order', 'items.orderLine']);

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        $returnRequests = $query->latest()->paginate(20);

        return OrderReturnRequestResource::collection($returnRequests);
    }

    public function show(Request $request, $id)
    {
        if (! $this->canManageOrders($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $returnRequest = OrderReturnRequest::with(['order', 'items.orderLine'])->find($id);

        if (! $returnRequest) {
            return response()->json(['message' => 'Return request not found'], 404);
        }

        return new OrderReturnRequestResource($returnRequest);
    }

    public function approve(Request $request, $id)
    {
        if (! $this->canManageOrders($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = Validator::make($request->all(), [
            'rma_address' => 'required|string|max:2000',
            'fee_waived' => 'nullable|boolean',
            'refund_amount' => 'nullable|numeric|min:0',
            'admin_note' => 'nullable|string|max:2000',
        ])->validate();

        $returnRequest = OrderReturnRequest::with(['order', 'items.orderLine'])->find($id);

        if (! $returnRequest) {
            return response()->json(['message' => 'Return request not found'], 404);
        }

        $refundAmountOverrideMinor = isset($validated['refund_amount'])
            ? (int) round((float) $validated['refund_amount'] * 100)
            : null;

        try {
            $returnRequest = $this->returnRequestService->approve(
                $returnRequest,
                $validated['rma_address'],
                (bool) ($validated['fee_waived'] ?? false),
                $refundAmountOverrideMinor,
                $validated['admin_note'] ?? null,
            );
        } catch (ValidationException $e) {
            return response()->json(['message' => $e->getMessage(), 'errors' => $e->errors()], 422);
        }

        return new OrderReturnRequestResource($returnRequest);
    }

    public function reject(Request $request, $id)
    {
        if (! $this->canManageOrders($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = Validator::make($request->all(), [
            'admin_note' => 'nullable|string|max:2000',
        ])->validate();

        $returnRequest = OrderReturnRequest::with(['order', 'items.orderLine'])->find($id);

        if (! $returnRequest) {
            return response()->json(['message' => 'Return request not found'], 404);
        }

        try {
            $returnRequest = $this->returnRequestService->reject($returnRequest, $validated['admin_note'] ?? null);
        } catch (ValidationException $e) {
            return response()->json(['message' => $e->getMessage(), 'errors' => $e->errors()], 422);
        }

        return new OrderReturnRequestResource($returnRequest);
    }

    public function complete(Request $request, $id)
    {
        if (! $this->canManageOrders($request)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $returnRequest = OrderReturnRequest::with(['order', 'items.orderLine'])->find($id);

        if (! $returnRequest) {
            return response()->json(['message' => 'Return request not found'], 404);
        }

        try {
            $returnRequest = $this->returnRequestService->complete($returnRequest);
        } catch (ValidationException $e) {
            return response()->json(['message' => $e->getMessage(), 'errors' => $e->errors()], 422);
        }

        return new OrderReturnRequestResource($returnRequest);
    }

    private function canManageOrders(Request $request): bool
    {
        return (bool) $request->user()?->hasAnyRole([
            'super_admin',
            'admin',
            'staff',
            'Order Manager',
            'Support',
        ]);
    }
}
