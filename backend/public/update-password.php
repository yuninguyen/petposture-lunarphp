<?php
use Illuminate\Contracts\Console\Kernel;

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

use App\Models\User;
use Illuminate\Support\Facades\Hash;

$email = 'yuninguyen.it@gmail.com';
$password = '@Yuni2026';

$user = User::where('email', $email)->first();

if ($user) {
    $user->password = Hash::make($password);
    $user->save();
    echo "PASSWORD_UPDATED_SUCCESSFULLY\n";
    echo "Email: $email\n";
    echo "New Password: $password\n";
} else {
    echo "USER_NOT_FOUND\n";
}
