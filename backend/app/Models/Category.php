<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\HasSeo;

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
