<?php
echo "Starting composer update...\n";
$output = [];
$return_var = -1;
exec('composer update lunarphp/lunar --no-interaction 2>&1', $output, $return_var);

$result = "Return Var: $return_var\nOutput:\n" . implode("\n", $output);
file_put_contents('composer_result.txt', $result);
echo "Done. Result written to composer_result.txt\n";
