<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';

use App\Models\User;
use Illuminate\Support\Facades\Hash;

$email = 'yuninguyen.it@gmail.com';
$user = User::where('email', $email)->first();

if ($user) {
    echo "USER_FOUND\n";
    echo "Email: " . $user->email . "\n";
    echo "Password Hash: " . $user->password . "\n";
} else {
    echo "USER_NOT_FOUND\n";

    // List some users to see what's there
    $users = User::take(5)->get();
    echo "Existing users:\n";
    foreach ($users as $u) {
        echo "- " . $u->email . "\n";
    }
}
