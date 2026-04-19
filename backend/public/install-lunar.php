<?php
set_time_limit(600);
header('Content-Type: text/plain');

echo "PetPosture Lunar Recovery v1.4\n";
chdir(__DIR__ . '/..');
echo "CWD: " . getcwd() . "\n";

$cmd = 'composer update lunarphp/lunar kalnoy/nestedset --no-interaction --prefer-dist --no-dev --with-all-dependencies --no-scripts 2>&1';
echo "Running: $cmd\n";

$output = [];
$return_var = -1;
exec($cmd, $output, $return_var);

echo "Return: $return_var\n";
echo "Output:\n";
echo implode("\n", $output);
