<?php

use App\Http\Controllers\Api\SeoController;
use App\Http\Controllers\Api\SitemapController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/sitemap.xml', [SitemapController::class, 'index']);
Route::get('/api/seo', [SeoController::class, 'show']); // ?path=shop/product-slug

Route::get('/_setup/seed-attributes', function () {
    $groups = \Lunar\Models\AttributeGroup::all(['id', 'handle', 'name']);
    $existing = \Lunar\Models\Attribute::whereHandle('name')
        ->whereAttributeType(\Lunar\Models\Product::morphName())
        ->first();

    if ($existing) {
        return response()->json(['status' => 'already exists', 'attribute' => $existing]);
    }

    $group = $groups->first();
    if (!$group) {
        $group = \Lunar\Models\AttributeGroup::create([
            'attributable_type' => \Lunar\Models\Product::morphName(),
            'name'     => ['en' => 'Details'],
            'handle'   => 'details',
            'position' => 1,
        ]);
    }

    $attr = \Lunar\Models\Attribute::create([
        'attribute_type'   => \Lunar\Models\Product::morphName(),
        'attribute_group_id' => $group->id,
        'position'         => 1,
        'name'             => ['en' => 'Name'],
        'handle'           => 'name',
        'section'          => 'main',
        'type'             => \Lunar\FieldTypes\Text::class,
        'required'         => true,
        'default_value'    => null,
        'configuration'    => null,
        'system'           => true,
    ]);

    return response()->json(['status' => 'created', 'attribute' => $attr, 'groups' => $groups]);
});