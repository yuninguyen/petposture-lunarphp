<?php

namespace App\Filament\Resources;

use App\Filament\Resources\CustomerResource\Pages\ViewCustomer;
use App\Filament\Resources\CustomerResource\RelationManagers\OrdersRelationManager;
use Lunar\Admin\Filament\Resources\CustomerResource as BaseCustomerResource;
use Lunar\Admin\Filament\Resources\CustomerResource\RelationManagers\AddressRelationManager;
use Lunar\Admin\Filament\Resources\CustomerResource\RelationManagers\UserRelationManager;

class CustomerResource extends BaseCustomerResource
{
    public static function getNavigationSort(): ?int
    {
        return 3;
    }

    public static function getDefaultRelations(): array
    {
        return [
            // Overrides Lunar's base OrdersRelationManager, which links to
            // Lunar's own ManageOrder page — this app's OrderResource uses
            // a custom ViewOrder page instead, under a different route name.
            OrdersRelationManager::class,
            AddressRelationManager::class,
            UserRelationManager::class,
        ];
    }

    public static function getDefaultPages(): array
    {
        return array_merge(parent::getDefaultPages(), [
            // Lunar's own ViewCustomer page hardcodes $resource to Lunar's
            // base CustomerResource, which bypasses getDefaultRelations()
            // above entirely. This override points it back at this class.
            'view' => ViewCustomer::route('/{record}'),
        ]);
    }
}
