<?php

use App\Http\Controllers\Api\SeoController;
use App\Http\Controllers\Api\SitemapController;
use Illuminate\Support\Facades\Route;
use Lunar\Models\Attribute;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/_setup/fix-product-options', function () {
    $product = \Lunar\Models\Product::with('variants', 'productOptions')->findOrFail(1);

    $knownSizes = ['X-Small', 'X-Large', 'Small', 'Medium', 'Large'];
    $locale = app()->getLocale() ?: 'en';

    // Parse SKUs → [variantId => [size, color]]
    $parsed = [];
    foreach ($product->variants as $variant) {
        // Remove prefix "PUAH305NYSM-"
        $rest = preg_replace('/^[^-]+-/', '', $variant->sku);
        $size = null;
        $color = null;
        foreach ($knownSizes as $s) {
            if (str_starts_with($rest, $s . '-')) {
                $size  = $s;
                $color = substr($rest, strlen($s) + 1);
                break;
            }
        }
        if ($size && $color) {
            $parsed[$variant->id] = ['size' => $size, 'color' => $color];
        }
    }

    if (empty($parsed)) {
        return response()->json(['error' => 'No SKUs could be parsed']);
    }

    $uniqueSizes  = array_unique(array_column($parsed, 'size'));
    $uniqueColors = array_unique(array_column($parsed, 'color'));

    // Get or create ProductOption "Size"
    $sizeOption = \Lunar\Models\ProductOption::firstOrCreate(
        ['handle' => 'size'],
        ['name' => [$locale => 'Size']]
    );
    if (! ($sizeOption->name[$locale] ?? null)) {
        $sizeOption->name = [$locale => 'Size'];
        $sizeOption->save();
    }

    // Get or create ProductOption "Color"
    $colorOption = \Lunar\Models\ProductOption::firstOrCreate(
        ['handle' => 'color'],
        ['name' => [$locale => 'Color']]
    );
    if (! ($colorOption->name[$locale] ?? null)) {
        $colorOption->name = [$locale => 'Color'];
        $colorOption->save();
    }

    // Link options to product (skip if already linked)
    $existingOptionIds = $product->productOptions()->pluck('id')->toArray();
    foreach ([$sizeOption->id, $colorOption->id] as $pos => $optId) {
        if (! in_array($optId, $existingOptionIds)) {
            $product->productOptions()->attach($optId, ['position' => $pos + 1]);
        }
    }

    // Create size option values
    $sizeValues = [];
    foreach (array_values($uniqueSizes) as $pos => $sizeName) {
        $val = \Lunar\Models\ProductOptionValue::firstOrCreate(
            ['option_id' => $sizeOption->id, 'name->en' => $sizeName],
            ['name' => [$locale => $sizeName], 'position' => $pos + 1]
        );
        $sizeValues[$sizeName] = $val;
    }

    // Create color option values
    $colorValues = [];
    foreach (array_values($uniqueColors) as $pos => $colorName) {
        $val = \Lunar\Models\ProductOptionValue::firstOrCreate(
            ['option_id' => $colorOption->id, 'name->en' => $colorName],
            ['name' => [$locale => $colorName], 'position' => $pos + 1]
        );
        $colorValues[$colorName] = $val;
    }

    // Link each variant to its size + color values
    $linked = [];
    foreach ($parsed as $variantId => $info) {
        $variant = $product->variants->find($variantId);
        $valueIds = [];
        if (isset($sizeValues[$info['size']])) {
            $valueIds[] = $sizeValues[$info['size']]->id;
        }
        if (isset($colorValues[$info['color']])) {
            $valueIds[] = $colorValues[$info['color']]->id;
        }
        if ($valueIds) {
            $variant->values()->syncWithoutDetaching($valueIds);
            $linked[] = $variant->sku . ' → ' . $info['size'] . ' / ' . $info['color'];
        }
    }

    return response()->json([
        'status'       => 'done',
        'size_option'  => $sizeOption->id,
        'color_option' => $colorOption->id,
        'sizes'        => array_keys($sizeValues),
        'colors'       => array_keys($colorValues),
        'linked_count' => count($linked),
        'sample'       => array_slice($linked, 0, 5),
    ]);
});

Route::get('/_setup/fix-attribute-config', function () {
    $fixed = [];

    foreach (Attribute::all() as $attribute) {
        if (! ($attribute->getRawOriginal('configuration'))
            || $attribute->getRawOriginal('configuration') === 'null'
            || $attribute->configuration === null) {
            $attribute->configuration = collect();
            $attribute->save();
            $fixed[] = $attribute->handle;
        }
    }

    return response()->json(['status' => 'fixed', 'updated' => $fixed]);
});

Route::get('/sitemap.xml', [SitemapController::class, 'index']);
Route::get('/api/seo', [SeoController::class, 'show']); // ?path=shop/product-slug
