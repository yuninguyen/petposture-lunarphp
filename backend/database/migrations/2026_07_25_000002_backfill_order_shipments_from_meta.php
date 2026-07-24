<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Lunar\Models\Order;

return new class extends Migration
{
    public function up(): void
    {
        Order::query()
            ->whereNotNull('meta->tracking_number')
            ->with('lines')
            ->chunkById(100, function ($orders) {
                foreach ($orders as $order) {
                    $meta = (array) ($order->meta ?? []);
                    $trackingNumber = trim((string) ($meta['tracking_number'] ?? ''));
                    $carrier = $meta['shipment_carrier'] ?? 'manual';

                    if ($trackingNumber === '') {
                        continue;
                    }

                    // CheckoutService seeds meta.tracking_number = order reference on every
                    // order at checkout time (before any real shipment exists), and the
                    // legacy admin fallback did the same when tracking was left blank.
                    // OrderResource already treats this exact pattern as "not real tracking
                    // info" — skip it here too so we don't backfill a fake shipment for
                    // orders that were never actually shipped.
                    if ($carrier === 'manual' && $trackingNumber === $order->reference) {
                        continue;
                    }

                    $shipmentId = DB::table('order_shipments')->insertGetId([
                        'order_id' => $order->id,
                        'tracking_number' => $trackingNumber,
                        'carrier' => $carrier,
                        'tracking_url' => $meta['shipment_tracking_url'] ?? null,
                        'status' => in_array((string) $order->status, ['delivered'], true) ? 'delivered' : 'in_transit',
                        'shipped_at' => $meta['shipped_at'] ?? null,
                        'delivered_at' => $meta['delivered_at'] ?? null,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);

                    $lines = $order->lines->where('type', '!=', 'shipping');

                    foreach ($lines as $line) {
                        DB::table('order_shipment_items')->insert([
                            'order_shipment_id' => $shipmentId,
                            'order_line_id' => $line->id,
                            'quantity' => $line->quantity,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                    }
                }
            });
    }

    public function down(): void
    {
        // Irreversible data backfill — order_shipments/order_shipment_items are
        // dropped entirely by the prior migration's down() if that's rolled back too.
    }
};
