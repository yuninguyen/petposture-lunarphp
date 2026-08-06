<?php

namespace App\Filament\Resources\RoleResource\Pages;

use App\Filament\Resources\RoleResource;
use BezhanSalleh\FilamentShield\Resources\RoleResource\Pages\ViewRole as BaseViewRole;
use Filament\Actions\EditAction;

class ViewRole extends BaseViewRole
{
    protected static string $resource = RoleResource::class;

    protected function getActions(): array
    {
        return [
            EditAction::make()
                ->icon('heroicon-o-pencil-square')
                ->color('primary')
                ->outlined()
                ->extraAttributes(['style' => 'font-weight: 500;']),
        ];
    }
}
