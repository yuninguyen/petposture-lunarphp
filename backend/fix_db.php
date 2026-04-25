<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';

use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;

$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

try {
    echo "Adding columns to orders table...\n";

    if (!Schema::hasColumn('orders', 'email')) {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('email')->after('user_id')->nullable();
        });
        echo "Added 'email' column.\n";
    }

    if (!Schema::hasColumn('orders', 'tracking_number')) {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('tracking_number')->after('shipping_address')->nullable()->unique();
        });
        echo "Added 'tracking_number' column.\n";
    }

    echo "Success!\n";
} catch (\Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
