<?php

namespace App\Models;

use App\Traits\HasMetadata;
use App\Traits\HasSeo;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Post extends Model
{
    use HasFactory, HasMetadata, HasSeo;

    public const TYPE_ARTICLE = 'article';

    public const TYPE_GUIDE = 'guide';

    public const TYPE_COMPARISON = 'comparison';

    protected $fillable = [
        'blog_category_id',
        'type',
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
