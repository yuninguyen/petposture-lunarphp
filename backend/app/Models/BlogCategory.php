<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BlogCategory extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'slug', 'description', 'image_url'];

    public function posts()
    {
        return $this->hasMany(Post::class, 'blog_category_id');
    }
}
