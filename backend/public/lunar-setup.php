<?php
set_time_limit(300);
header('Content-Type: text/plain');

echo "PetPosture Lunar Installer v1.5\n";
chdir(__DIR__ . '/..');
echo "CWD: " . getcwd() . "\n";

$cmd = 'php artisan lunar:install --no-interaction 2>&1';
echo "Running: $cmd\n";

$output = [];
$return_var = -1;
exec($cmd, $output, $return_var);

echo "Return: $return_var\n";
echo "Output:\n";
echo implode("\n", $output);
