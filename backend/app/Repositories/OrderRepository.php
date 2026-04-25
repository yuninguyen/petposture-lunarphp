<?php

namespace App\Repositories;

use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Support\Collection;

class OrderRepository
{
    /**
     * Find an order by its primary ID.
     */
    public function findById(int $id): ?Order
    {
        return Order::with('orderItems.product')->find($id);
    }

    /**
     * Find an order by its unique tracking number and customer email.
     */
    public function findByTracking(string $trackingNumber, string $email): ?Order
    {
        return Order::with('orderItems.product')
            ->where('tracking_number', $trackingNumber)
            ->where('email', $email)
            ->first();
    }

    /**
     * Get all orders for a specific user.
     */
    public function findByUserId(int $userId): Collection
    {
        return Order::with('orderItems.product')
            ->where('user_id', $userId)
            ->latest()
            ->get();
    }

    /**
     * Persist a new order to the database.
     */
    public function create(array $data): Order
    {
        return Order::create($data);
    }

    /**
     * Persist an order item.
     */
    public function createItem(array $data): OrderItem
    {
        return OrderItem::create($data);
    }
}
