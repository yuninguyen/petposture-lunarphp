<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Lunar\Models\Collection;
use Lunar\Models\Url;

$collections = Collection::all();
$data = [];

foreach ($collections as $c) {
    $data[] = [
        'id' => $c->id,
        'name' => $c->translateAttribute('name'),
        'slug' => $c->defaultUrl?->slug ?? 'NULL',
        'raw_urls' => Url::where('element_type', Collection::class)->where('element_id', $c->id)->get()->toArray()
    ];
}

file_put_contents('collections_audit.json', json_encode($data, JSON_PRETTY_PRINT));
echo "Audit complete: collections_audit.json\n";
