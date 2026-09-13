<?php

namespace App\Http\Controllers\Api\Admin;

use App\DiscountTypes\FreeShipping;
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
use Lunar\DiscountTypes\BuyXGetY;
use Lunar\Models\Collection as LunarCollection;
use Lunar\Models\Product as LunarProduct;

class DiscountController extends Controller
{
    private const TYPES = [
        AmountOff::class => 'Amount off',
        FreeShipping::class => 'Free shipping',
        BuyXGetY::class => 'Buy X get Y',
    ];

    public function index(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('search', ''));
        $discounts = Discount::query()
            ->with([
                'collections',
                'discountableLimitations.discountable',
                'discountableConditions.discountable',
                'discountableRewards.discountable',
            ])
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

        $this->syncLimitations($discount, $validated);

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

        $this->syncLimitations($discount, $validated);

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

        if (isset($input['buy_type']) && ! isset($input['condition_type'])) {
            $input['condition_type'] = $input['buy_type'];
        }
        if (isset($input['buy_collection_ids']) && ! isset($input['condition_collection_ids'])) {
            $input['condition_collection_ids'] = $input['buy_collection_ids'];
        }
        if (isset($input['buy_product_ids']) && ! isset($input['condition_product_ids'])) {
            $input['condition_product_ids'] = $input['buy_product_ids'];
        }
        if (isset($input['get_product_ids']) && ! isset($input['reward_product_ids'])) {
            $input['reward_product_ids'] = $input['get_product_ids'];
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
            'data.min_qty' => ['nullable', 'integer', 'min:1'],
            'data.reward_qty' => ['nullable', 'integer', 'min:1'],
            'data.max_reward_qty' => ['nullable', 'integer', 'min:1'],
            'data.automatically_add_rewards' => ['nullable', 'boolean'],
            'applies_to' => ['nullable', 'string', Rule::in(['all_products', 'specific_collections', 'specific_products'])],
            'collection_ids' => ['nullable', 'array'],
            'collection_ids.*' => ['integer', Rule::exists((new LunarCollection)->getTable(), 'id')],
            'product_ids' => ['nullable', 'array'],
            'product_ids.*' => ['integer', Rule::exists((new LunarProduct)->getTable(), 'id')],
            'condition_type' => ['nullable', 'string', Rule::in(['specific_collections', 'specific_products'])],
            'condition_collection_ids' => ['nullable', 'array'],
            'condition_collection_ids.*' => ['integer', Rule::exists((new LunarCollection)->getTable(), 'id')],
            'condition_product_ids' => ['nullable', 'array'],
            'condition_product_ids.*' => ['integer', Rule::exists((new LunarProduct)->getTable(), 'id')],
            'reward_product_ids' => ['nullable', 'array'],
            'reward_product_ids.*' => ['integer', Rule::exists((new LunarProduct)->getTable(), 'id')],
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

            if ($type === BuyXGetY::class) {
                $minQty = $input['data']['min_qty'] ?? null;
                if ($minQty === null || ! is_numeric($minQty) || (int) $minQty < 1) {
                    $validator->errors()->add('data.min_qty', 'The minimum quantity is required and must be at least 1.');
                }

                $rewardQty = $input['data']['reward_qty'] ?? null;
                if ($rewardQty === null || ! is_numeric($rewardQty) || (int) $rewardQty < 1) {
                    $validator->errors()->add('data.reward_qty', 'The reward quantity is required and must be at least 1.');
                }

                $conditionType = $input['condition_type'] ?? 'specific_products';
                $conditionCollectionIds = $input['condition_collection_ids'] ?? [];
                $conditionProductIds = $input['condition_product_ids'] ?? [];
                if ($conditionType === 'specific_collections' && empty($conditionCollectionIds)) {
                    $validator->errors()->add('condition_collection_ids', 'At least one collection is required for Customer buys.');
                }
                if ($conditionType === 'specific_products' && empty($conditionProductIds)) {
                    $validator->errors()->add('condition_product_ids', 'At least one product is required for Customer buys.');
                }

                $rewardProductIds = $input['reward_product_ids'] ?? [];
                if (empty($rewardProductIds)) {
                    $validator->errors()->add('reward_product_ids', 'At least one product is required for Customer gets.');
                }
            }

            $appliesTo = $input['applies_to'] ?? 'all_products';
            if ($appliesTo === 'specific_collections' && empty($input['collection_ids'])) {
                $validator->errors()->add('collection_ids', 'At least one collection is required when applying to specific collections.');
            }
            if ($appliesTo === 'specific_products' && empty($input['product_ids'])) {
                $validator->errors()->add('product_ids', 'At least one product is required when applying to specific products.');
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
            'priority' => $validated['priority'] ?? 1,
            'stop' => $validated['stop'] ?? false,
            'max_uses' => $validated['max_uses'] ?? null,
            'max_uses_per_user' => $validated['max_uses_per_user'] ?? null,
            'data' => $this->normalizedData($validated),
        ];
    }

    private function normalizedData(array $validated): array
    {
        $incoming = $validated['data'] ?? [];
        $type = $validated['type'] ?? null;
        $data = ['min_prices' => ['USD' => $this->minor($incoming['min_prices']['USD'] ?? null)]];

        if ($type === FreeShipping::class) {
            return [
                ...$data,
                'free_shipping' => true,
            ];
        }

        if ($type === BuyXGetY::class) {
            return [
                ...$data,
                'min_qty' => isset($incoming['min_qty']) ? (int) $incoming['min_qty'] : 1,
                'reward_qty' => isset($incoming['reward_qty']) ? (int) $incoming['reward_qty'] : 1,
                'max_reward_qty' => isset($incoming['max_reward_qty']) && $incoming['max_reward_qty'] !== null && $incoming['max_reward_qty'] !== ''
                    ? (int) $incoming['max_reward_qty']
                    : null,
                'automatically_add_rewards' => (bool) ($incoming['automatically_add_rewards'] ?? false),
            ];
        }

        return ($incoming['fixed_value'] ?? false)
            ? [...$data, 'fixed_value' => true, 'fixed_values' => ['USD' => $this->minor($incoming['fixed_values']['USD'] ?? null)]]
            : [...$data, 'fixed_value' => false, 'percentage' => $incoming['percentage'] ?? null];
    }

    private function syncLimitations(Discount $discount, array $validated): void
    {
        $type = $validated['type'] ?? $discount->type;
        $appliesTo = $validated['applies_to'] ?? 'all_products';

        $existingLimitationCollections = $discount->collections()
            ->wherePivot('type', 'limitation')
            ->pluck((new LunarCollection)->getTable().'.id');
        if ($existingLimitationCollections->isNotEmpty()) {
            $discount->collections()->detach($existingLimitationCollections);
        }

        $discount->discountableLimitations()->delete();
        $discount->discountableConditions()->delete();
        $discount->discountableRewards()->delete();

        if ($type === AmountOff::class) {
            if ($appliesTo === 'specific_collections') {
                $collectionIds = array_unique(array_map('intval', $validated['collection_ids'] ?? []));
                if (! empty($collectionIds)) {
                    $attachData = [];
                    foreach ($collectionIds as $id) {
                        $attachData[$id] = ['type' => 'limitation'];
                    }
                    $discount->collections()->attach($attachData);
                }
            } elseif ($appliesTo === 'specific_products') {
                $productIds = array_unique(array_map('intval', $validated['product_ids'] ?? []));
                if (! empty($productIds)) {
                    $morphClass = (new LunarProduct)->getMorphClass();
                    foreach ($productIds as $productId) {
                        $discount->discountableLimitations()->create([
                            'discountable_type' => $morphClass,
                            'discountable_id' => $productId,
                            'type' => 'limitation',
                        ]);
                    }
                }
            }
        } elseif ($type === BuyXGetY::class) {
            $conditionType = $validated['condition_type'] ?? 'specific_products';
            if ($conditionType === 'specific_collections') {
                $collectionIds = array_unique(array_map('intval', $validated['condition_collection_ids'] ?? []));
                $morphClass = (new LunarCollection)->getMorphClass();
                foreach ($collectionIds as $collectionId) {
                    $discount->discountableConditions()->create([
                        'discountable_type' => $morphClass,
                        'discountable_id' => $collectionId,
                        'type' => 'condition',
                    ]);
                }
            } else {
                $productIds = array_unique(array_map('intval', $validated['condition_product_ids'] ?? []));
                $morphClass = (new LunarProduct)->getMorphClass();
                foreach ($productIds as $productId) {
                    $discount->discountableConditions()->create([
                        'discountable_type' => $morphClass,
                        'discountable_id' => $productId,
                        'type' => 'condition',
                    ]);
                }
            }

            $rewardProductIds = array_unique(array_map('intval', $validated['reward_product_ids'] ?? []));
            $morphClass = (new LunarProduct)->getMorphClass();
            foreach ($rewardProductIds as $productId) {
                $discount->discountableRewards()->create([
                    'discountable_type' => $morphClass,
                    'discountable_id' => $productId,
                    'type' => 'reward',
                ]);
            }
        }

        $discount->load([
            'collections',
            'discountableLimitations.discountable',
            'discountableConditions.discountable',
            'discountableRewards.discountable',
        ]);
    }

    private function resource(Discount $discount): array
    {
        if (! $discount->relationLoaded('collections')) {
            $discount->load('collections');
        }
        if (! $discount->relationLoaded('discountableLimitations')) {
            $discount->load('discountableLimitations.discountable');
        }
        if (! $discount->relationLoaded('discountableConditions')) {
            $discount->load('discountableConditions.discountable');
        }
        if (! $discount->relationLoaded('discountableRewards')) {
            $discount->load('discountableRewards.discountable');
        }

        $limitationCollections = $discount->collections->where('pivot.type', 'limitation');
        $limitationProducts = $discount->discountableLimitations;

        if ($limitationCollections->isNotEmpty()) {
            $appliesTo = 'specific_collections';
        } elseif ($limitationProducts->isNotEmpty()) {
            $appliesTo = 'specific_products';
        } else {
            $appliesTo = 'all_products';
        }

        $collectionIds = $limitationCollections->pluck('id')->values()->all();
        $collectionsData = $limitationCollections->map(function ($c) {
            $name = null;
            if (method_exists($c, 'translateAttribute')) {
                $name = $c->translateAttribute('name');
            }
            return [
                'id' => $c->id,
                'name' => (string) ($name ?: ($c->attribute_data['name']['value'] ?? $c->name ?? "Collection #{$c->id}")),
            ];
        })->values()->all();

        $productIds = $limitationProducts->pluck('discountable_id')->values()->all();
        $productsData = $limitationProducts->map(function ($lim) {
            $p = $lim->discountable;
            $name = null;
            if ($p && method_exists($p, 'translateAttribute')) {
                $name = $p->translateAttribute('name');
            }
            return [
                'id' => $lim->discountable_id,
                'name' => (string) ($name ?: ($p?->attribute_data['name']['value'] ?? $p?->name ?? "Product #{$lim->discountable_id}")),
            ];
        })->values()->all();

        $conditionCollections = $discount->discountableConditions
            ->filter(fn ($c) => $c->discountable_type === (new LunarCollection)->getMorphClass() || $c->discountable instanceof LunarCollection);
        $conditionProducts = $discount->discountableConditions
            ->filter(fn ($c) => $c->discountable_type === (new LunarProduct)->getMorphClass() || $c->discountable instanceof LunarProduct);
        $rewardProducts = $discount->discountableRewards
            ->filter(fn ($r) => $r->discountable_type === (new LunarProduct)->getMorphClass() || $r->discountable instanceof LunarProduct);

        $conditionType = $conditionCollections->isNotEmpty() ? 'specific_collections' : 'specific_products';

        $conditionCollectionIds = $conditionCollections->pluck('discountable_id')->values()->all();
        $conditionCollectionsData = $conditionCollections->map(function ($cond) {
            $c = $cond->discountable;
            $name = null;
            if ($c && method_exists($c, 'translateAttribute')) {
                $name = $c->translateAttribute('name');
            }
            return [
                'id' => $cond->discountable_id,
                'name' => (string) ($name ?: ($c?->attribute_data['name']['value'] ?? $c?->name ?? "Collection #{$cond->discountable_id}")),
            ];
        })->values()->all();

        $conditionProductIds = $conditionProducts->pluck('discountable_id')->values()->all();
        $conditionProductsData = $conditionProducts->map(function ($cond) {
            $p = $cond->discountable;
            $name = null;
            if ($p && method_exists($p, 'translateAttribute')) {
                $name = $p->translateAttribute('name');
            }
            return [
                'id' => $cond->discountable_id,
                'name' => (string) ($name ?: ($p?->attribute_data['name']['value'] ?? $p?->name ?? "Product #{$cond->discountable_id}")),
            ];
        })->values()->all();

        $rewardProductIds = $rewardProducts->pluck('discountable_id')->values()->all();
        $rewardProductsData = $rewardProducts->map(function ($rew) {
            $p = $rew->discountable;
            $name = null;
            if ($p && method_exists($p, 'translateAttribute')) {
                $name = $p->translateAttribute('name');
            }
            return [
                'id' => $rew->discountable_id,
                'name' => (string) ($name ?: ($p?->attribute_data['name']['value'] ?? $p?->name ?? "Product #{$rew->discountable_id}")),
            ];
        })->values()->all();

        if ($discount->type === AmountOff::class) {
            $typeLabel = $appliesTo === 'all_products' ? 'Amount off order' : 'Amount off products';
        } else {
            $typeLabel = self::TYPES[$discount->type] ?? 'Unsupported';
        }

        return [
            'id' => $discount->id,
            'name' => $discount->name,
            'handle' => $discount->handle,
            'coupon' => $discount->coupon,
            'type' => $discount->type,
            'type_label' => $typeLabel,
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
            'applies_to' => $appliesTo,
            'collection_ids' => $collectionIds,
            'collections' => $collectionsData,
            'product_ids' => $productIds,
            'products' => $productsData,
            'condition_type' => $conditionType,
            'condition_collection_ids' => $conditionCollectionIds,
            'condition_collections' => $conditionCollectionsData,
            'condition_product_ids' => $conditionProductIds,
            'condition_products' => $conditionProductsData,
            'reward_product_ids' => $rewardProductIds,
            'reward_products' => $rewardProductsData,
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

        if ($discount->type === FreeShipping::class) {
            return [
                ...$normalized,
                'free_shipping' => true,
            ];
        }

        if ($discount->type === BuyXGetY::class) {
            return [
                ...$normalized,
                'min_qty' => isset($data['min_qty']) ? (int) $data['min_qty'] : null,
                'reward_qty' => isset($data['reward_qty']) ? (int) $data['reward_qty'] : 1,
                'max_reward_qty' => isset($data['max_reward_qty']) && $data['max_reward_qty'] !== null ? (int) $data['max_reward_qty'] : null,
                'automatically_add_rewards' => (bool) ($data['automatically_add_rewards'] ?? false),
            ];
        }

        return ($data['fixed_value'] ?? false)
            ? [...$normalized, 'fixed_value' => true, 'fixed_values' => ['USD' => $this->decimal($data['fixed_values']['USD'] ?? null)]]
            : [...$normalized, 'fixed_value' => false, 'percentage' => isset($data['percentage']) ? (float) $data['percentage'] : null];
    }

    private function isSupported(Discount $discount): bool
    {
        return in_array($discount->getRawOriginal('type'), array_keys(self::TYPES), true);
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
