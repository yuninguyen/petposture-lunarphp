<?php

namespace App\Filament\Widgets;

use App\Models\Review;
use App\Models\User;
use Filament\Widgets\Widget;
use Lunar\Models\Order;
use Spatie\Permission\Exceptions\RoleDoesNotExist;

class RecentActivityWidget extends Widget
{
    protected static string $view = 'filament.widgets.recent-activity';

    protected static ?int $sort = 4;

    protected int|string|array $columnSpan = [
        'default' => 1,
        'md' => 2,
        'xl' => 1,
    ];

    protected function getViewData(): array
    {
        $events = collect();

        foreach (Order::whereNotNull('placed_at')->latest('placed_at')->limit(5)->get() as $order) {
            $events->push([
                'icon' => 'heroicon-o-shopping-cart',
                'color' => '#df8448',
                'title' => __('admin.dashboard.activity.order_placed'),
                'description' => __('admin.dashboard.activity.order_placed_desc', ['reference' => $order->reference]),
                'at' => $order->placed_at,
            ]);
        }

        $customers = (function () {
            try {
                return User::role('customer')->latest()->limit(5)->get();
            } catch (RoleDoesNotExist $e) {
                return User::latest()->limit(5)->get();
            }
        })();

        foreach ($customers as $customer) {
            $events->push([
                'icon' => 'heroicon-o-user-plus',
                'color' => '#38c68b',
                'title' => __('admin.dashboard.activity.customer_registered'),
                'description' => __('admin.dashboard.activity.customer_registered_desc', ['name' => $customer->name]),
                'at' => $customer->created_at,
            ]);
        }

        foreach (Review::latest()->limit(5)->get() as $review) {
            $events->push([
                'icon' => 'heroicon-o-star',
                'color' => '#f5a623',
                'title' => __('admin.dashboard.activity.review_received'),
                'description' => __('admin.dashboard.activity.review_received_desc', [
                    'rating' => $review->rating,
                    'name' => $review->customer_name,
                ]),
                'at' => $review->created_at,
            ]);
        }

        $events = $events
            ->filter(fn ($event) => $event['at'] !== null)
            ->sortByDesc('at')
            ->take(6)
            ->values();

        return [
            'events' => $events,
        ];
    }
}
