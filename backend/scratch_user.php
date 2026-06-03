<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

$users = User::all();
foreach ($users as $u) {
    echo "User ID: {$u->id}, Name: {$u->name}, Email: {$u->email}\n";
    echo "  Roles: " . implode(', ', $u->getRoleNames()->toArray()) . "\n";
    $permissions = $u->getAllPermissions()->pluck('name')->toArray();
    echo "  Permissions count: " . count($permissions) . "\n";
}
