<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Discount;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Lunar\DiscountTypes\AmountOff;

class DiscountController extends Controller
{
    private const TYPES = [
        AmountOff::class => 'Amount off',
    ];

    public function index(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('search', ''));
        $discounts = Discount::query()
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $query) => $query
                ->where('name', 'like', "%{$search}%")
                ->orWhere('coupon', 'like', "%{$search}%")))
            ->latest('created_at')
            ->paginate(15);

        return response()->json([
            'data' => $discounts->getCollection()->map(fn (Discount $discount): array => $this->resource($discount))->values(),
            'meta' => [
                'current_page' => $discounts->currentPage(),
                'last_page' => $discounts->lastPage(),
                'per_page' => $discounts->perPage(),
                'total' => $discounts->total(),
            ],
        ], options: JSON_PRESERVE_ZERO_FRACTION);
    }

    public function store(Request $request): JsonResponse
    {
        $input = $request->all();
        if (! isset($input['handle']) || trim((string) $input['handle']) === '') {
            $input['handle'] = Str::slug((string) ($input['name'] ?? ''));
        }

        $validated = $this->validated($input);
        $discount = new Discount($this->attributes($validated));
        $discount->save();

        return response()->json(['data' => $this->resource($discount)], Response::HTTP_CREATED, options: JSON_PRESERVE_ZERO_FRACTION);
    }

    public function show(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->resource($this->findDiscount($request))], options: JSON_PRESERVE_ZERO_FRACTION);
    }

    public function update(Request $request): JsonResponse
    {
        $discount = $this->findDiscount($request);
        if (! $this->isSupported($discount)) {
            throw ValidationException::withMessages(['type' => 'Unsupported discount types cannot be updated.']);
        }

        $validated = $this->validated($request->all(), $discount);
        $discount->update($this->attributes($validated));

        return response()->json(['data' => $this->resource($discount->refresh())], options: JSON_PRESERVE_ZERO_FRACTION);
    }

    public function destroy(Request $request): Response
    {
        $this->findDiscount($request)->delete();

        return response()->noContent();
    }

    private function findDiscount(Request $request): Discount
    {
        $routeDiscount = $request->route('discount');
        $id = $routeDiscount instanceof Model ? $routeDiscount->getKey() : $routeDiscount;
        $attributes = Discount::query()->findOrFail($id)->getAttributes();
        $discount = new Discount;
        $discount->setRawAttributes($attributes, true);
        $discount->exists = true;

        return $discount;
    }

    private function validated(array $input, ?Discount $discount = null): array
    {
        $uniqueHandle = Rule::unique('lunar_discounts', 'handle');
        $uniqueCoupon = Rule::unique('lunar_discounts', 'coupon');
        if ($discount) {
            $uniqueHandle->ignore($discount);
            $uniqueCoupon->ignore($discount);
        }

        $validator = validator($input, [
            'name' => ['required', 'string', 'max:255'],
            'handle' => ['required', 'string', 'max:255', $uniqueHandle],
            'coupon' => ['required', 'string', 'max:255', $uniqueCoupon],
            'type' => ['required', 'string', Rule::in(array_keys(self::TYPES))],
            'starts_at' => ['required', 'date'],
            'ends_at' => ['nullable', 'date', 'after:starts_at'],
            'priority' => ['nullable', 'integer'],
            'stop' => ['boolean'],
            'max_uses' => ['nullable', 'integer', 'min:1'],
            'max_uses_per_user' => ['nullable', 'integer', 'min:1'],
            'data' => ['nullable', 'array'],
            'data.min_prices' => ['nullable', 'array'],
            'data.min_prices.USD' => ['nullable', 'numeric', 'min:0'],
            'data.fixed_value' => ['nullable', 'boolean'],
            'data.percentage' => ['nullable', 'numeric', 'between:0,100'],
            'data.fixed_values' => ['nullable', 'array'],
            'data.fixed_values.USD' => ['nullable', 'numeric', 'min:0'],
            'data.min_qty' => ['nullable', 'integer', 'min:0'],
            'data.reward_qty' => ['nullable', 'integer', 'min:0'],
            'data.max_reward_qty' => ['nullable', 'integer', 'min:0'],
            'data.automatically_add_rewards' => ['nullable', 'boolean'],
        ]);

        $validator->after(function ($validator) use ($input): void {
            $type = $input['type'] ?? null;
            $fixedValue = $input['data']['fixed_value'] ?? false;
            $fixedUsd = $input['data']['fixed_values']['USD'] ?? null;
            $percentage = $input['data']['percentage'] ?? null;

            if ($type === AmountOff::class && $fixedValue && $fixedUsd === null) {
                $validator->errors()->add('data.fixed_values.USD', 'The fixed USD value is required.');
            }

            if ($type === AmountOff::class && ! $fixedValue && $percentage === null) {
                $validator->errors()->add('data.percentage', 'The percentage is required.');
            }
        });

        return $validator->validate();
    }

    private function attributes(array $validated): array
    {
        return [
            'name' => $validated['name'],
            'handle' => $validated['handle'],
            'coupon' => $validated['coupon'] ?? null,
            'type' => $validated['type'],
            'starts_at' => $validated['starts_at'],
            'ends_at' => $validated['ends_at'] ?? null,
            'priority' => $validated['priority'] ?? null,
            'stop' => $validated['stop'] ?? false,
            'max_uses' => $validated['max_uses'] ?? null,
            'max_uses_per_user' => $validated['max_uses_per_user'] ?? null,
            'data' => $this->normalizedData($validated),
        ];
    }

    private function normalizedData(array $validated): array
    {
        $incoming = $validated['data'] ?? [];
        $data = ['min_prices' => ['USD' => $this->minor($incoming['min_prices']['USD'] ?? null)]];

        return ($incoming['fixed_value'] ?? false)
            ? [...$data, 'fixed_value' => true, 'fixed_values' => ['USD' => $this->minor($incoming['fixed_values']['USD'] ?? null)]]
            : [...$data, 'fixed_value' => false, 'percentage' => $incoming['percentage'] ?? null];
    }

    private function resource(Discount $discount): array
    {
        return [
            'id' => $discount->id,
            'name' => $discount->name,
            'handle' => $discount->handle,
            'coupon' => $discount->coupon,
            'type' => $discount->type,
            'type_label' => self::TYPES[$discount->type] ?? 'Unsupported',
            'supported' => $this->isSupported($discount),
            'status' => $discount->status,
            'starts_at' => $discount->starts_at?->toISOString(),
            'ends_at' => $discount->ends_at?->toISOString(),
            'uses' => $discount->uses,
            'max_uses' => $discount->max_uses,
            'max_uses_per_user' => $discount->max_uses_per_user,
            'priority' => $discount->priority,
            'stop' => (bool) $discount->stop,
            'data' => $this->dataForResponse($discount),
            'created_at' => $discount->created_at?->toISOString(),
            'updated_at' => $discount->updated_at?->toISOString(),
        ];
    }

    private function dataForResponse(Discount $discount): array
    {
        $data = $discount->data;
        if (! is_array($data)) {
            $data = json_decode((string) $discount->getRawOriginal('data'), true) ?: [];
        }

        $normalized = ['min_prices' => ['USD' => $this->decimal($data['min_prices']['USD'] ?? null)]];

        if (! $this->isSupported($discount)) {
            return $normalized;
        }

        return ($data['fixed_value'] ?? false)
            ? [...$normalized, 'fixed_value' => true, 'fixed_values' => ['USD' => $this->decimal($data['fixed_values']['USD'] ?? null)]]
            : [...$normalized, 'fixed_value' => false, 'percentage' => isset($data['percentage']) ? (float) $data['percentage'] : null];
    }

    private function isSupported(Discount $discount): bool
    {
        return $discount->getRawOriginal('type') === AmountOff::class;
    }

    private function minor(float|int|null $decimal): ?int
    {
        return $decimal === null ? null : (int) round($decimal * 100);
    }

    private function decimal(int|float|null $minor): ?float
    {
        return $minor === null ? null : $minor / 100;
    }
}
