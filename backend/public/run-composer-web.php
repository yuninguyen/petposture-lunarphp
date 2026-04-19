<?php
set_time_limit(600); // 10 minutes
header('Content-Type: text/plain');

echo "PetPosture Composer Trigger v1.2\n";
echo "Changing working directory to project root...\n";
chdir(__DIR__ . '/..');
echo "Current directory: " . getcwd() . "\n";
echo "Attempting to install lunarphp/lunar with all dependencies...\n";

$output = [];
$return_var = -1;
// Using --prefer-dist and --with-all-dependencies
exec('composer update lunarphp/lunar --no-interaction --prefer-dist --no-dev --with-all-dependencies 2>&1', $output, $return_var);

echo "Return Var: $return_var\n";
echo "Output:\n";
echo implode("\n", $output);
