<?php

namespace App\Models;

use App\Models\Legacy\Product;
use App\Traits\HasSeo;
use Illuminate\Database\Eloquent\Model;

class Category extends Model
{
    use HasSeo;

    protected $fillable = ['name', 'slug', 'description', 'image_url', 'type', 'parent_id'];

    public function scopeBlog($query)
    {
        return $query->where('type', 'blog');
    }

    public function scopeProduct($query)
    {
        return $query->where('type', 'product');
    }

    public function scopeTopLevel($query)
    {
        return $query->whereNull('parent_id');
    }

    public function parent()
    {
        return $this->belongsTo(Category::class, 'parent_id');
    }

    public function children()
    {
        return $this->hasMany(Category::class, 'parent_id');
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
