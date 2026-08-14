<?php

namespace App\Models;

use App\Traits\HasSeo;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Lunar\Models\Product;

class Breed extends Model
{
    use HasFactory, HasSeo;

    protected $fillable = ['name', 'slug', 'body_type', 'description'];

    public function products(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'breed_product', 'breed_id', 'lunar_product_id')
            ->withPivot('priority')
            ->orderByPivot('priority');
    }

    public function posts(): BelongsToMany
    {
        return $this->belongsToMany(Post::class, 'post_breed');
    }
}
