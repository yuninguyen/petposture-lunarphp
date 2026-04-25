<?php
use Illuminate\Contracts\Console\Kernel;

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

use Illuminate\Support\Facades\Schema;

Schema::dropIfExists('comments');
echo "TABLE_DROPPED_SUCCESSFULLY\n";
