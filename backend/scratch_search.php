<?php

require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

foreach (DB::select('SHOW TABLES') as $t) {
    $table = array_values((array)$t)[0];
    try {
        $rows = DB::table($table)->get();
        foreach ($rows as $row) {
            $str = json_encode($row);
            if (strpos($str, 'petposture.com') !== false) {
                echo "$table: $str\n";
            }
        }
    } catch (\Exception $e) {
        // Ignored
    }
}
