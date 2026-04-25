<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\HasMetadata;
use App\Traits\HasSeo;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

class Product extends Model implements HasMedia
{
    use HasMetadata, HasSeo, InteractsWithMedia;

    protected $fillable = [
        'category_id',
        'brand_id',
        'name',
        'slug',
        'price',
        'old_price',
        'stock_quantity',
        'description',
        'image_url',
        'badge',
        'is_new',
        'rating',
        'reviews_count',
        'tax_status',
        'tax_class',
        'weight',
        'length',
        'width',
        'height',
        'shipping_class',
        'embed_code',
        'is_active'
    ];

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function reviews()
    {
        return $this->hasMany(Review::class);
    }

    public function variants()
    {
        return $this->hasMany(ProductVariant::class);
    }

    public function syncMapping()
    {
        return $this->hasOne(ProductSyncMapping::class, 'legacy_product_id');
    }

    public function registerMediaCollections(): void
    {
        $this
            ->addMediaCollection('product-images')
            ->useDisk('public')
            ->singleFile();
    }

    public function registerMediaConversions(?Media $media = null): void
    {
        $this
            ->addMediaConversion('thumb')
            ->width(320)
            ->height(400)
            ->performOnCollections('product-images')
            ->nonQueued();
    }
}
