<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ShippingMethod extends Model
{
    protected $fillable = [
        'code',
        'name',
        'eta',
        'price',
        'free_over',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'free_over' => 'decimal:2',
    ];
}
