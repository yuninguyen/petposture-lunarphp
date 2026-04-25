<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Lunar\Models\Collection;
use Lunar\Models\Url;
use Illuminate\Support\Str;

$collections = Collection::all();

foreach ($collections as $c) {
    $name = $c->translateAttribute('name');
    $slug = Str::slug($name);

    $existing = Url::where('element_type', Collection::class)
        ->where('element_id', $c->id)
        ->first();

    if ($existing) {
        echo "Updating URL for Collection '{$name}' (ID: {$c->id}) to '{$slug}'\n";
        $existing->update(['slug' => $slug, 'default' => true]);
    } else {
        echo "Creating URL for Collection '{$name}' (ID: {$c->id}) with slug '{$slug}'\n";
        Url::create([
            'element_type' => Collection::class,
            'element_id' => $c->id,
            'slug' => $slug,
            'default' => true,
            'language_id' => 1,
        ]);
    }
}

echo "Collection URLs synchronized successfully.\n";
