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

    public function tags()
    {
        return $this->belongsToMany(BlogTag::class, 'blog_post_tag');
    }

    public function breeds()
    {
        return $this->belongsToMany(Breed::class, 'post_breed');
    }

    public static function estimateReadTime(string $html): string
    {
        $words = str_word_count(strip_tags($html));
        $minutes = max(1, (int) ceil($words / 200));

        return "{$minutes} min read";
    }

    public function publishChecklistWarnings(): array
    {
        $warnings = [];

        if (blank($this->seo?->description)) {
            $warnings[] = __('Meta description is empty');
        }

        if (filled($this->featured_image) && blank($this->featured_image_alt)) {
            $warnings[] = __('Featured image has no alt text');
        }

        if ($this->type === self::TYPE_COMPARISON && ! $this->getMeta('disclosure_shown', true)) {
            $warnings[] = __('Affiliate disclosure banner is turned off');
        }

        return $warnings;
    }

    public function hasOutOfStockComparisonItems(): bool
    {
        if ($this->type !== self::TYPE_COMPARISON) {
            return false;
        }

        foreach ($this->getMeta('comparison_items', []) as $item) {
            if (($item['in_stock'] ?? true) === false) {
                return true;
            }
        }

        return false;
    }
}
