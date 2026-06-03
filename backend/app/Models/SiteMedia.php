<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;

class SiteMedia extends Model implements HasMedia
{
    use InteractsWithMedia;

    protected $table = 'site_media';

    protected $fillable = ['title', 'collection'];

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection('banner');
        $this->addMediaCollection('blog');
        $this->addMediaCollection('general');
    }
}
