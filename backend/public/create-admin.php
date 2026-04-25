<?php
use Illuminate\Contracts\Console\Kernel;

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

use App\Models\User;
use Illuminate\Support\Facades\Hash;

$email = 'yuninguyen.it@gmail.com';
$password = 'password'; // You can change this later

$user = User::where('email', $email)->first();

if (!$user) {
    $user = new User();
    $user->name = 'Admin';
    $user->email = $email;
    $user->password = Hash::make($password);
    $user->save();
    echo "USER_CREATED_SUCCESSFULLY\n";
    echo "Email: $email\n";
    echo "Password: $password\n";
} else {
    echo "USER_ALREADY_EXISTS\n";
}
