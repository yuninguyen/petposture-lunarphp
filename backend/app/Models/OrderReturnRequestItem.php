<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Lunar\Models\OrderLine;

class OrderReturnRequestItem extends Model
{
    protected $fillable = [
        'return_request_id',
        'order_line_id',
        'quantity',
    ];

    public function returnRequest(): BelongsTo
    {
        return $this->belongsTo(OrderReturnRequest::class, 'return_request_id');
    }

    public function orderLine(): BelongsTo
    {
        return $this->belongsTo(OrderLine::class);
    }
}
