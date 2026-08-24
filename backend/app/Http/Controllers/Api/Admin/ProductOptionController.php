<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Lunar\Models\Language;
use Lunar\Models\Product;
use Lunar\Models\ProductOption;
use Lunar\Models\ProductOptionValue;

class ProductOptionController extends Controller
{
    public function store(Request $request, Product $product): JsonResponse
    {
        $validated = $request->validate([
            'options' => ['present', 'array', 'max:10'],
            'options.*.id' => ['nullable', 'integer', 'distinct'],
            'options.*.name' => ['required', 'string', 'max:255', 'distinct:ignore_case'],
            'options.*.values' => ['required', 'array', 'min:1', 'max:100'],
            'options.*.values.*.id' => ['nullable', 'integer', 'distinct'],
            'options.*.values.*.name' => ['required', 'string', 'max:255'],
        ]);

        $options = DB::transaction(function () use ($validated, $product) {
            $locked = Product::query()->lockForUpdate()->findOrFail($product->id);
            $language = Language::getDefault();

            if (! $language) {
                throw ValidationException::withMessages([
                    'options' => 'A default language is required to manage product options.',
                ]);
            }

            $existing = $locked->productOptions()->with('values')->lockForUpdate()->get()->keyBy('id');
            $sync = [];

            foreach ($validated['options'] as $optionIndex => $optionData) {
                $option = empty($optionData['id'])
                    ? new ProductOption(['shared' => false])
                    : $existing->get((int) $optionData['id']);

                if (! $option) {
                    throw ValidationException::withMessages([
                        "options.{$optionIndex}.id" => 'The selected option does not belong to this product.',
                    ]);
                }

                if (! $option->shared) {
                    $option->name = [$language->code => $optionData['name']];
                    $option->label = [$language->code => $optionData['name']];
                    $option->save();
                    $option->handle = Str::slug($optionData['name']).'-'.$locked->id.'-'.$option->id;
                    $option->save();

                    $existingValues = $option->values()->lockForUpdate()->get()->keyBy('id');
                    $keptValueIds = [];

                    foreach ($optionData['values'] as $valueIndex => $valueData) {
                        $value = empty($valueData['id'])
                            ? new ProductOptionValue(['product_option_id' => $option->id])
                            : $existingValues->get((int) $valueData['id']);

                        if (! $value) {
                            throw ValidationException::withMessages([
                                "options.{$optionIndex}.values.{$valueIndex}.id" => 'The selected value does not belong to this option.',
                            ]);
                        }

                        $value->name = [$language->code => $valueData['name']];
                        $value->position = $valueIndex + 1;
                        $value->meta = array_merge((array) ($value->meta ?? []), ['admin_active' => true]);
                        $value->save();
                        $keptValueIds[] = $value->id;
                    }

                    $option->values()->whereNotIn('id', $keptValueIds)->get()->each(function (ProductOptionValue $value): void {
                        $value->meta = array_merge((array) ($value->meta ?? []), ['admin_active' => false]);
                        $value->save();
                    });
                }

                $sync[$option->id] = ['position' => $optionIndex + 1];
            }

            $locked->productOptions()->sync($sync);

            return $locked->productOptions()->with('values')->get();
        });

        return response()->json([
            'data' => $options->map(fn (ProductOption $option): array => [
                'id' => $option->id,
                'name' => $option->translate('name') ?? '',
                'shared' => (bool) $option->shared,
                'values' => $option->values
                    ->filter(fn (ProductOptionValue $value): bool => ($value->meta['admin_active'] ?? true) !== false)
                    ->map(fn (ProductOptionValue $value): array => [
                        'id' => $value->id,
                        'name' => $value->translate('name') ?? '',
                    ])->values()->all(),
            ])->values()->all(),
        ]);
    }
}
