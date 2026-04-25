<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

use App\Traits\HasMetadata;
use App\Traits\HasSeo;

class Post extends Model
{
    use HasFactory, HasMetadata, HasSeo;

    protected $fillable = [
        'blog_category_id',
        'title',
        'slug',
        'content',
        'featured_image',
        'author',
        'read_time',
        'status',
        'published_at',
    ];

    protected $casts = [
        'published_at' => 'datetime',
    ];

    public function blogCategory()
    {
        return $this->belongsTo(BlogCategory::class, 'blog_category_id');
    }

    public function comments()
    {
        return $this->hasMany(Comment::class);
    }
}
