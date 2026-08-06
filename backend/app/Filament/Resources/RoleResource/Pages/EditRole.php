<?php

namespace App\Filament\Resources\RoleResource\Pages;

use App\Filament\Resources\RoleResource;
use BezhanSalleh\FilamentShield\Resources\RoleResource\Pages\EditRole as BaseEditRole;
use Filament\Actions\DeleteAction;

class EditRole extends BaseEditRole
{
    protected static string $resource = RoleResource::class;

    protected function getActions(): array
    {
        return [
            DeleteAction::make()
                ->icon('heroicon-o-trash')
                ->color('danger')
                ->outlined()
                ->extraAttributes(['style' => 'font-weight: 500;']),
        ];
    }
}
