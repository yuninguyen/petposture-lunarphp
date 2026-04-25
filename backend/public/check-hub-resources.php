<?php
use Illuminate\Contracts\Console\Kernel;

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

use Filament\Facades\Filament;

$panel = Filament::getPanel('lunar');
$resources = $panel->getResources();

echo "HUB_PANEL_PTH: " . $panel->getPath() . "\n";
echo "RESOURCES_COUNT: " . count($resources) . "\n";

foreach ($resources as $resource) {
    echo "RESOURCE: $resource\n";
}
