<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
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

        return response()->json($this->detailResource($customer));
    }

    public function update(Customer $customer, Request $request): JsonResponse
    {
        $customer->fill($request->validate([
            'first_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'last_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'company_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'tax_identifier' => ['sometimes', 'nullable', 'string', 'max:255'],
        ]));
        $customer->save();

        return $this->show($customer->refresh());
    }

    public function updateAddress(Customer $customer, Address $address, Request $request): JsonResponse
    {
        $this->ensureAddressBelongsToCustomer($customer, $address);

        $address->fill($request->validate([
            'title' => ['sometimes', 'nullable', 'string', 'max:255'],
            'first_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'last_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'line_one' => ['sometimes', 'nullable', 'string', 'max:255'],
            'line_two' => ['sometimes', 'nullable', 'string', 'max:255'],
            'line_three' => ['sometimes', 'nullable', 'string', 'max:255'],
            'city' => ['sometimes', 'nullable', 'string', 'max:255'],
            'state' => ['sometimes', 'nullable', 'string', 'max:255'],
            'postcode' => ['sometimes', 'nullable', 'string', 'max:255'],
            'contact_phone' => ['sometimes', 'nullable', 'string', 'max:255'],
            'contact_email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'shipping_default' => ['sometimes', 'boolean'],
            'billing_default' => ['sometimes', 'boolean'],
        ]));
        $address->save();

        return response()->json($this->address($address));
    }

    public function destroyAddress(Customer $customer, Address $address): JsonResponse
    {
        $this->ensureAddressBelongsToCustomer($customer, $address);
        $address->delete();

        return response()->json(null, 204);
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

    public function updateLoginAccount(Customer $customer, User $user, Request $request): JsonResponse
    {
        abort_unless($customer->users()->whereKey($user->getKey())->exists(), 404);

        if (blank($request->input('password'))) {
            $request->merge(['password' => null, 'password_confirmation' => null]);
        }

        $validated = $request->validate([
            'email' => ['required', 'email', Rule::unique('users', 'email')->ignore($user)],
            'password' => ['nullable', 'string', 'min:8', 'confirmed'],
        ]);

        $user->email = $validated['email'];

        if (filled($validated['password'] ?? null)) {
            $user->password = Hash::make($validated['password']);
        }

        $user->save();

        return response()->json([
            'data' => [
                'id' => $user->id,
                'email' => $user->email,
            ],
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

    private function detailResource(Customer $customer): array
    {
        $resource = $this->resource($customer);
        $user = $customer->users->sortBy('id')->first();
        $address = $customer->addresses()->orderBy('id')->first();

        return [
            ...$resource,
            'email' => $user?->email,
            'first_name' => $customer->first_name,
            'last_name' => $customer->last_name,
            'company_name' => $customer->company_name,
            'tax_identifier' => $customer->tax_identifier,
            'phone' => $address?->contact_phone,
        ];
    }

    private function ensureAddressBelongsToCustomer(Customer $customer, Address $address): void
    {
        abort_unless($address->customer_id === $customer->id, 404);
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
                'formatted' => '$'.number_format($decimal, 2),
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
