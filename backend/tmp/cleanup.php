<?php

function rrmdir($dir)
{
    if (is_dir($dir)) {
        $objects = scandir($dir);
        foreach ($objects as $object) {
            if ($object != "." && $object != "..") {
                if (is_dir($dir . DIRECTORY_SEPARATOR . $object) && !is_link($dir . "/" . $object))
                    rrmdir($dir . DIRECTORY_SEPARATOR . $object);
                else
                    unlink($dir . DIRECTORY_SEPARATOR . $object);
            }
        }
        rmdir($dir);
        echo "Deleted directory: $dir\n";
    } else {
        echo "Directory not found: $dir\n";
    }
}

function runlink($file)
{
    if (file_exists($file)) {
        unlink($file);
        echo "Deleted file: $file\n";
    } else {
        echo "File not found: $file\n";
    }
}

// 1. Delete Filament Resources
runlink('c:/laragon/www/petposture/backend/app/Filament/Resources/ProductAttributeResource.php');
rrmdir('c:/laragon/www/petposture/backend/app/Filament/Resources/ProductAttributeResource');
rrmdir('c:/laragon/www/petposture/backend/app/Filament/Resources/ProductResource/RelationManagers');

// 2. Delete Models
runlink('c:/laragon/www/petposture/backend/app/Models/ProductAttribute.php');
runlink('c:/laragon/www/petposture/backend/app/Models/ProductAttributeValue.php');
runlink('c:/laragon/www/petposture/backend/app/Models/ProductVariant.php');

echo "Cleanup complete.\n";
