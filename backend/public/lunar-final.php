<?php
set_time_limit(600);
header('Content-Type: text/plain');

echo "PetPosture Lunar Final Setup v1.0\n";
chdir(__DIR__ . '/..');

echo "Running: php artisan lunar:install --no-interaction\n";
$cmd = 'php artisan lunar:install --no-interaction 2>&1';

$output = [];
$return_var = -1;
exec($cmd, $output, $return_var);

echo "Return: $return_var\n";
echo "Output:\n";
echo implode("\n", $output);
