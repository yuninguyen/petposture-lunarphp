<?php

namespace App\Services\Admin;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Lunar\Admin\Actions\Products\MapVariantsToProductOptions;
use Lunar\Admin\Events\ProductVariantOptionsUpdated;
use Lunar\Models\Product;
use Lunar\Models\ProductVariant;

class ProductVariantMatrixService
{
    public function generate(Product $product): Collection
    {
        $variants = DB::transaction(function () use ($product): Collection {
            $locked = Product::query()->lockForUpdate()->findOrFail($product->id);
            $options = $locked->productOptions()->with('values')->lockForUpdate()->get();
            $options->each(fn ($option) => $option->setRelation(
                'values',
                $option->values->filter(fn ($value): bool => ($value->meta['admin_active'] ?? true) !== false)->values()
            ));
            $allVariants = $locked->variants()->withTrashed()
                ->with(['values', 'prices'])
                ->lockForUpdate()
                ->orderBy('id')
                ->get();

            if ($allVariants->isEmpty()) {
                throw ValidationException::withMessages([
                    'variants' => 'The product must have at least one variant before generating a matrix.',
                ]);
            }

            if ($options->isEmpty()) {
                $keeper = $allVariants->sortBy(fn (ProductVariant $variant) => $variant->trashed() ? 1 : 0)
                    ->first(fn (ProductVariant $variant) => $variant->values->isEmpty());

                if ($keeper) {
                    $keeper->restore();
                } else {
                    $source = $allVariants->first(fn (ProductVariant $variant) => ! $variant->trashed()) ?? $allVariants->first();
                    $keeper = $source->replicate();
                    $keeper->product_id = $locked->id;
                    $keeper->deleted_at = null;
                    $keeper->sku = $this->generatedSku($source->sku, ['base']);
                    $keeper->save();
                    foreach ($source->prices as $price) {
                        $copy = $price->replicate();
                        $copy->priceable_id = $keeper->id;
                        $copy->save();
                    }
                    $allVariants->push($keeper);
                }

                $allVariants->reject(fn (ProductVariant $variant) => $variant->id === $keeper->id)
                    ->each(fn (ProductVariant $variant) => $variant->delete());

                return $locked->variants()->with(['values.option', 'prices.currency'])->orderBy('id')->get();
            }

            $emptyOption = $options->first(fn ($option) => $option->values->isEmpty());
            if ($emptyOption) {
                throw ValidationException::withMessages([
                    'options' => 'Every product option must contain at least one value.',
                ]);
            }

            $projectedCount = $options->reduce(fn (int $total, $option): int => $total * $option->values->count(), 1);
            if ($projectedCount > 1000) {
                throw ValidationException::withMessages([
                    'options' => 'The variant matrix cannot exceed 1,000 permutations.',
                ]);
            }

            $optionValues = $options->mapWithKeys(
                fn ($option): array => [(string) $option->id => $option->values->pluck('id')->all()]
            )->all();
            $activeValueIds = $options->flatMap(fn ($option) => $option->values)->pluck('id')->map(fn ($id) => (int) $id)->all();
            $optionCount = $options->count();

            $variantSnapshots = $allVariants->filter(function (ProductVariant $variant) use ($activeValueIds, $optionCount): bool {
                $valueIds = $variant->values->pluck('id')->map(fn ($id) => (int) $id);

                return $valueIds->count() === $optionCount
                    && $valueIds->every(fn (int $id) => in_array($id, $activeValueIds, true));
            })->map(fn (ProductVariant $variant): array => [
                'id' => $variant->id,
                'sku' => $variant->sku,
                'price' => 0,
                'stock' => $variant->stock,
                'values' => $variant->values->mapWithKeys(
                    fn ($value): array => [(string) $value->product_option_id => $value->id]
                )->all(),
            ])->values()->all();

            if ($variantSnapshots === [] && $allVariants->every(fn (ProductVariant $variant) => $variant->values->isEmpty())) {
                $seed = $allVariants->first();
                $variantSnapshots[] = [
                    'id' => $seed->id,
                    'sku' => $seed->sku,
                    'price' => 0,
                    'stock' => $seed->stock,
                    'values' => [],
                ];
            }

            $mapped = MapVariantsToProductOptions::map($optionValues, $variantSnapshots);
            $template = $allVariants->first(fn (ProductVariant $variant) => ! $variant->trashed()) ?? $allVariants->first();
            $keptIds = [];

            foreach ($mapped as $permutation) {
                $variant = ! empty($permutation['variant_id'])
                    ? $allVariants->firstWhere('id', (int) $permutation['variant_id'])
                    : null;

                if ($variant) {
                    $variant->restore();
                } else {
                    $sourceId = $permutation['copied_id'] ?? $template->id;
                    $source = $allVariants->firstWhere('id', (int) $sourceId) ?? $template;
                    $variant = $source->replicate();
                    $variant->product_id = $locked->id;
                    $variant->deleted_at = null;
                    $variant->sku = $this->generatedSku($source->sku, $permutation['values']);
                    $variant->save();

                    foreach ($source->prices as $price) {
                        $copy = $price->replicate();
                        $copy->priceable_id = $variant->id;
                        $copy->save();
                    }

                    $allVariants->push($variant->load(['values', 'prices']));
                }

                $variant->values()->sync(array_values($permutation['values']));
                $keptIds[] = $variant->id;
            }

            $allVariants->reject(fn (ProductVariant $variant) => in_array($variant->id, $keptIds, true))
                ->each(fn (ProductVariant $variant) => $variant->delete());

            return $locked->variants()->with(['values.option', 'prices.currency'])->orderBy('id')->get();
        });

        ProductVariantOptionsUpdated::dispatch($product->fresh());

        return $variants;
    }

    private function generatedSku(?string $baseSku, array $values): string
    {
        $prefix = trim((string) $baseSku) ?: 'VARIANT';

        return $prefix.'-'.implode('-', array_values($values));
    }
}
