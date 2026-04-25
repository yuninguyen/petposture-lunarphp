<?php
use Illuminate\Contracts\Console\Kernel;

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

use Lunar\Admin\Models\Staff;

$email = 'yuninguyen.it@gmail.com';
$staff = Staff::where('email', $email)->first();

if ($staff) {
    echo "STAFF_FOUND: " . $staff->email . "\n";
    echo "CURRENT_ADMIN_FLAG: " . ($staff->admin ? 'YES' : 'NO') . "\n";
    if (!$staff->admin) {
        $staff->admin = true;
        $staff->save();
        echo "ADMIN_FLAG_UPDATED_TO_YES\n";
    }
} else {
    echo "STAFF_NOT_FOUND\n";
}
