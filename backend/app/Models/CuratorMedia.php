<?php

namespace App\Models;

use Awcodes\Curator\Models\Media;

class CuratorMedia extends Media
{
    public const FOLDER_BANNER = 'banner';

    public const FOLDER_BLOG = 'blog';

    public const FOLDER_PRODUCT = 'product';

    public const FOLDER_BREED = 'breed';

    public const FOLDER_SOLUTION = 'solution';

    public const FOLDER_GENERAL = 'general';

    public const FOLDERS = [
        self::FOLDER_BANNER,
        self::FOLDER_BLOG,
        self::FOLDER_PRODUCT,
        self::FOLDER_BREED,
        self::FOLDER_SOLUTION,
        self::FOLDER_GENERAL,
    ];

    protected $table = 'curator_media';
}
