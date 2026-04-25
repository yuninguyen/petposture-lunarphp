<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$o = \Lunar\Models\Order::where('reference', '00000006')->first();
if ($o) {
    $meta = $o->meta;
    $meta['coupon_code'] = 'SAVE10';
    $meta['tax_rate_percentage'] = 7.5;
    $o->meta = $meta;
    $o->save();
    echo "DONE\n";
}
