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
        'featured_image_alt',
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

    public function clicks()
    {
        return $this->hasMany(AffiliateClick::class);
    }

    public function comments()
    {
        return $this->hasMany(Comment::class);
    }

    public static function estimateReadTime(string $html): string
    {
        $words = str_word_count(strip_tags($html));
        $minutes = max(1, (int) ceil($words / 200));

        return "{$minutes} min read";
    }
}
