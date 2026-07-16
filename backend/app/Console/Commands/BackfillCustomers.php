<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\CustomerLinkService;
use Illuminate\Console\Command;
use Lunar\Models\Order;

class BackfillCustomers extends Command
{
    protected $signature = 'customers:backfill';

    protected $description = 'Link existing customer-role users to Lunar Customer records and backfill order customer_id';

    public function handle(CustomerLinkService $customerLinkService): int
    {
        $linked = 0;

        User::role('customer')
            ->whereDoesntHave('customers')
            ->chunkById(200, function ($users) use ($customerLinkService, &$linked) {
                foreach ($users as $user) {
                    $customerLinkService->resolveForUser($user);
                    $linked++;
                }
            });

        $ordersUpdated = 0;

        Order::whereNotNull('user_id')
            ->whereNull('customer_id')
            ->chunkById(200, function ($orders) use ($customerLinkService, &$ordersUpdated) {
                foreach ($orders as $order) {
                    $user = User::find($order->user_id);
                    if (! $user) {
                        continue;
                    }

                    $customer = $customerLinkService->resolveForUser($user);
                    $order->update(['customer_id' => $customer->id]);
                    $ordersUpdated++;
                }
            });

        $this->info("Linked {$linked} customers. Updated {$ordersUpdated} orders.");

        return self::SUCCESS;
    }
}
