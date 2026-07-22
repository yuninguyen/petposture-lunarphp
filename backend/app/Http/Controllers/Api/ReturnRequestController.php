<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\OrderReturnRequestResource;
use App\Models\OrderReturnRequest;
use App\Services\ReturnRequestService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Lunar\Models\Order;

class ReturnRequestController extends Controller
{
    public function __construct(
        private readonly ReturnRequestService $returnRequestService,
    ) {
    }

    /**
     * Submit a new return request (guest lookup via order reference + email).
     */
    public function store(Request $request)
    {
        $validated = Validator::make($request->all(), [
            'order_reference' => 'required|string',
            'email' => 'required|email',
            'reason' => 'required|string|max:160',
            'note' => 'nullable|string|max:2000',
            'items' => 'required|array|min:1',
            'items.*.order_line_id' => 'required|integer',
            'items.*.quantity' => 'required|integer|min:1',
        ])->validate();

        $order = $this->findPublicOrderByCredentials(
            trim((string) $validated['order_reference']),
            trim((string) $validated['email']),
        );

        if (! $order) {
            return response()->json(['message' => 'No order found with these credentials.'], 404);
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
            'refund_amount' => 'nullable|numeric|min:0',
            'admin_note' => 'nullable|string|max:2000',
        ])->validate();

        $returnRequest = OrderReturnRequest::with(['order', 'items.orderLine'])->find($id);

        if (! $returnRequest) {
            return response()->json(['message' => 'Return request not found'], 404);
        }

        $refundAmountMinor = isset($validated['refund_amount'])
            ? (int) round((float) $validated['refund_amount'] * 100)
            : null;

        try {
            $returnRequest = $this->returnRequestService->approve(
                $returnRequest,
                $validated['rma_address'],
                $refundAmountMinor,
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

    private function findPublicOrderByCredentials(string $reference, string $email): ?Order
    {
        return Order::with(['lines', 'shippingAddress', 'billingAddress'])
            ->where(function ($query) use ($reference) {
                $query->where('reference', $reference)
                    ->orWhere('meta->tracking_number', $reference);
            })
            ->where('customer_reference', $email)
            ->first();
    }
}
