<?php
set_time_limit(600);
header('Content-Type: text/plain');

echo "PetPosture Lunar Migration v1.6\n";
chdir(__DIR__ . '/..');
echo "CWD: " . getcwd() . "\n";

$cmd = 'php artisan migrate --force --no-interaction 2>&1';
echo "Running: $cmd\n";

$output = [];
$return_var = -1;
exec($cmd, $output, $return_var);

echo "Return: $return_var\n";
echo "Output:\n";
echo implode("\n", $output);
