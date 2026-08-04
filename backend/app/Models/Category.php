<?php

namespace App\Models;

use App\Models\Legacy\Product;
use App\Traits\HasSeo;
use Illuminate\Database\Eloquent\Model;

class Category extends Model
{
    use HasSeo;

    protected $fillable = ['name', 'slug', 'description', 'image_url', 'type'];

    public function scopeBlog($query)
    {
        return $query->where('type', 'blog');
    }

    public function scopeProduct($query)
    {
        return $query->where('type', 'product');
    }

    public function products()
    {
        return $this->hasMany(Product::class);
    }

    public function posts()
    {
        return $this->hasMany(Post::class);
    }
}
