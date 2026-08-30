<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Lunar\Models\Address;
use Lunar\Models\Customer;
use Lunar\Models\Order;

class CustomerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'in:active,inactive'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);
        $search = trim((string) ($validated['search'] ?? ''));
        $status = $validated['status'] ?? null;

        $customers = Customer::query()
            ->with('users')
            ->withCount('orders')
            ->withSum('orders', 'total')
            ->when($status === 'active', fn (Builder $query) => $query->whereDoesntHave(
                'users',
                fn (Builder $users) => $users->where('is_active', false),
            ))
            ->when($status === 'inactive', fn (Builder $query) => $query->whereHas(
                'users',
                fn (Builder $users) => $users->where('is_active', false),
            ))
            ->when($search !== '', fn (Builder $query) => $query->where(function (Builder $searchQuery) use ($search): void {
                $searchQuery->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhereHas('users', fn (Builder $users) => $users->where('email', 'like', "%{$search}%"));
            }))
            ->latest('created_at')
            ->paginate(15);

        return response()->json([
            'data' => $customers->getCollection()
                ->map(fn (Customer $customer): array => $this->resource($customer))
                ->values(),
            'meta' => [
                'current_page' => $customers->currentPage(),
                'last_page' => $customers->lastPage(),
                'per_page' => $customers->perPage(),
                'total' => $customers->total(),
            ],
        ]);
    }

    public function show(Customer $customer): JsonResponse
    {
        $customer->load(['users:id,email,is_active'])
            ->loadCount('orders')
            ->loadSum('orders', 'total');

        return response()->json($this->resource($customer));
    }

    public function orders(Customer $customer, Request $request): JsonResponse
    {
        $request->validate([
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $orders = $customer->orders()
            ->select(['id', 'reference', 'status', 'total', 'currency_code', 'created_at'])
            ->with('currency')
            ->latest('created_at')
            ->paginate(15);

        return response()->json([
            'data' => $orders->getCollection()
                ->map(fn (Order $order): array => $this->orderSummary($order))
                ->values(),
            'meta' => [
                'current_page' => $orders->currentPage(),
                'last_page' => $orders->lastPage(),
                'per_page' => $orders->perPage(),
                'total' => $orders->total(),
            ],
        ]);
    }

    public function addresses(Customer $customer): JsonResponse
    {
        $addresses = $customer->addresses()
            ->select([
                'id', 'title', 'first_name', 'last_name', 'line_one', 'line_two', 'line_three',
                'city', 'state', 'postcode', 'contact_phone', 'contact_email', 'shipping_default',
                'billing_default', 'created_at',
            ])
            ->get();

        return response()->json([
            'data' => $addresses->map(fn (Address $address): array => $this->address($address))->values(),
        ]);
    }

    public function loginAccounts(Customer $customer): JsonResponse
    {
        $accounts = $customer->users()
            ->select('users.id', 'users.email')
            ->get();

        return response()->json([
            'data' => $accounts->map(fn ($account): array => [
                'id' => $account->id,
                'email' => $account->email,
            ])->values(),
        ]);
    }

    private function resource(Customer $customer): array
    {
        $user = $customer->users->first();

        return [
            'id' => $customer->id,
            'name' => trim("{$customer->first_name} {$customer->last_name}"),
            'email' => $user?->email,
            'orders_count' => $customer->orders_count,
            'orders_sum_total' => $customer->orders_sum_total,
            'created_at' => $customer->created_at?->toISOString(),
            'status' => ($user?->is_active ?? true) ? 'active' : 'inactive',
        ];
    }

    private function orderSummary(Order $order): array
    {
        $decimal = $this->decimal($order->total);

        return [
            'id' => (string) $order->id,
            'reference' => $order->reference,
            'status' => $order->status,
            'status_label' => $order->status_label,
            'total' => [
                'formatted' => '$'.number_format($decimal, 2).' '.$order->currency_code,
                'decimal' => round($decimal, 2),
                'currency' => $order->currency_code,
            ],
            'created_at' => $order->created_at?->toDateTimeString(),
        ];
    }

    private function address(Address $address): array
    {
        return [
            'id' => $address->id,
            'title' => $address->title,
            'first_name' => $address->first_name,
            'last_name' => $address->last_name,
            'line_one' => $address->line_one,
            'line_two' => $address->line_two,
            'line_three' => $address->line_three,
            'city' => $address->city,
            'state' => $address->state,
            'postcode' => $address->postcode,
            'contact_phone' => $address->contact_phone,
            'contact_email' => $address->contact_email,
            'shipping_default' => $address->shipping_default,
            'billing_default' => $address->billing_default,
            'created_at' => $address->created_at?->toISOString(),
        ];
    }

    private function decimal(mixed $amount): float
    {
        if (is_object($amount) && method_exists($amount, 'decimal')) {
            return (float) $amount->decimal();
        }

        return is_numeric($amount) ? ((float) $amount) / 100 : 0.0;
    }
}
