<?php
use Illuminate\Contracts\Console\Kernel;

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

use App\Models\User;
use Lunar\Admin\Models\Staff;
use Illuminate\Support\Facades\Hash;

$email = 'yuninguyen.it@gmail.com';
$password = '@Yuni2026';

// 1. Create User
$user = User::where('email', $email)->first();
if (!$user) {
    $user = new User();
    $user->name = 'Admin';
    $user->email = $email;
    $user->password = Hash::make($password);
    $user->save();
    echo "USER_CREATED_SUCCESSFULLY\n";
} else {
    echo "USER_ALREADY_EXISTS\n";
}

// 2. Create Staff
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
    $staff->admin = true;
    $staff->save();
}

echo "ADMIN_READY\n";
