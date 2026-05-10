<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

$ids = [1, 2, 3, 4, 5, 6, 7, 8];
$out = "ID | Name | Connection | Database\n";
$out .= "-----------------------------------\n";

foreach ($ids as $id) {
    $p = DB::table('lunar_products')->where('id', $id)->first();
    if ($p) {
        $data = json_decode($p->attribute_data, true);
        $name = $data['name']['en'] ?? 'N/A';
        $out .= "ID $id | Name: $name\n";
    } else {
        $out .= "ID $id | NOT FOUND\n";
    }
}

$conn = DB::connection()->getDatabaseName();
$out .= "\nCurrent App DB: $conn\n";

file_put_contents('audit_ids_output.txt', $out);
echo "Audit complete.\n";
