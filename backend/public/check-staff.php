<?php
use Illuminate\Contracts\Console\Kernel;

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

use Lunar\Admin\Models\Staff;
use App\Models\User;

$staffCount = Staff::count();
echo "STAFF_COUNT: " . $staffCount . "\n";

$email = 'yuninguyen.it@gmail.com';
$user = User::where('email', $email)->first();

if ($user) {
    echo "USER_FOUND: " . $user->email . "\n";

    $staff = Staff::where('email', $email)->first();
    if (!$staff) {
        $staff = new Staff();
        $staff->email = $email;
        $staff->firstname = 'Admin';
        $staff->lastname = 'User';
        $staff->admin = true;
        $staff->save();
        echo "STAFF_CREATED_SUCCESSFULLY\n";
    } else {
        echo "STAFF_ALREADY_EXISTS\n";
        if (!$staff->admin) {
            $staff->admin = true;
            $staff->save();
            echo "STAFF_PROMOTED_TO_ADMIN\n";
        }
    }
} else {
    echo "USER_NOT_FOUND_IN_USERS_TABLE\n";
}
