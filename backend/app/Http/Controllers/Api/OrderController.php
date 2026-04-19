<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use Illuminate\Support\Facades\DB;

class OrderController extends Controller
{
    public function index()
    {
        $orders = Order::with('orderItems.product')->latest()->get();
        return response()->json($orders);
    }

    public function show($id)
    {
        $order = Order::with('orderItems.product')->find($id);

        if (!$order) {
            return response()->json(['message' => 'Order not found'], 404);
        }

        return response()->json($order);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'items' => 'required|array',
            'items.*.productId' => 'required|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
            'shipping' => 'required|array',
            'shipping.address' => 'required|string',
            'totalAmount' => 'required|numeric',
        ]);

        try {
            DB::beginTransaction();

            // Create Order
            $order = Order::create([
                'user_id' => auth('sanctum')->id(), // Tracks authenticated User or resolves to null for Guest Checkout bridging
                'total_amount' => $validated['totalAmount'],
                'status' => 'PENDING',
                'payment_method' => 'CASH_ON_DELIVERY', // Mocking for now
                'shipping_address' => $validated['shipping']['address'],
            ]);

            // Create OrderItems and reduce stock
            foreach ($validated['items'] as $item) {
                $product = Product::find($item['productId']);

                OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $product->id,
                    'quantity' => $item['quantity'],
                    'price_at_purchase' => $product->price,
                ]);

                // Update stock linearly
                if ($product->stock_quantity >= $item['quantity']) {
                    $product->decrement('stock_quantity', $item['quantity']);
                }
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'order_id' => $order->id,
                'message' => 'Order placed successfully.'
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Order creation failed.',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
