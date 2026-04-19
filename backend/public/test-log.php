<?php
$file = 'test-alive.log';
file_put_contents($file, date('Y-m-d H:i:s') . " - Still alive\n", FILE_APPEND);
echo "Logged to $file";
?>