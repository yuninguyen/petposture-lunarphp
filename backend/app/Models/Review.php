<?php

namespace App\Models;

use App\Services\ReviewPurchaseEvidenceService;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Lunar\Models\Order;
use Lunar\Models\OrderLine;
use Lunar\Models\Product;

/**
 * @property int $lunar_product_id
 * @property int|null $user_id
 * @property string|null $customer_email
 * @property int|null $lunar_order_id
 * @property int|null $lunar_order_line_id
 * @property bool $is_verified
 * @property-read Product|null $product
 */
class Review extends Model
{
    use HasFactory;

    protected $fillable = [
        'lunar_product_id',
        'user_id',
        'customer_name',
        'customer_email',
        'lunar_order_id',
        'lunar_order_line_id',
        'rating',
        'comment',
        'is_verified',
        'status',
    ];

    protected $casts = [
        'is_verified' => 'boolean',
    ];

    protected static function booted(): void
    {
        static::saving(function (Review $review): void {
            $review->is_verified = app(ReviewPurchaseEvidenceService::class)->qualifies($review);
        });
    }

    public function product()
    {
        return $this->belongsTo(Product::class, 'lunar_product_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function order()
    {
        return $this->belongsTo(Order::class, 'lunar_order_id');
    }

    public function orderLine()
    {
        return $this->belongsTo(OrderLine::class, 'lunar_order_line_id');
    }
}
