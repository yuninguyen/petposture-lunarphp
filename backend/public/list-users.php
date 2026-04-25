<?php
use Illuminate\Contracts\Console\Kernel;

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

use App\Models\User;

$users = User::all();
echo "TOTAL_USERS: " . $users->count() . "\n";
foreach ($users as $user) {
    echo "USER: " . $user->email . "\n";
}
