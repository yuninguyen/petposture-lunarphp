<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';

use App\Models\User;

$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$users = User::all();
foreach ($users as $user) {
    echo "ID: {$user->id} | Name: {$user->name} | Email: {$user->email}" . PHP_EOL;
}
