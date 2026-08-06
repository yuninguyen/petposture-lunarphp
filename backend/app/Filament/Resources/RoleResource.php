<?php

namespace App\Filament\Resources;

use App\Filament\Resources\RoleResource\Pages;
use BezhanSalleh\FilamentShield\Resources\RoleResource as BaseRoleResource;

class RoleResource extends BaseRoleResource
{
    public static function getNavigationGroup(): ?string
    {
        return __('System');
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListRoles::route('/'),
            'create' => Pages\CreateRole::route('/create'),
            'view' => Pages\ViewRole::route('/{record}'),
            'edit' => Pages\EditRole::route('/{record}/edit'),
        ];
    }
}
