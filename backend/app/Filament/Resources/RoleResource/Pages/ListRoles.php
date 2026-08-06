<?php

namespace App\Filament\Resources\RoleResource\Pages;

use App\Filament\Resources\RoleResource;
use Filament\Actions;
use Filament\Resources\Pages\ListRecords;
use Spatie\Permission\Models\Role;

class ListRoles extends ListRecords
{
    protected static string $resource = RoleResource::class;

    protected static string $view = 'filament.resources.role-resource.pages.list-roles';

    protected function getActions(): array
    {
        return [
            Actions\CreateAction::make(),
        ];
    }

    public function getRoles()
    {
        return Role::query()
            ->withCount(['permissions', 'users'])
            ->orderByDesc('permissions_count')
            ->get();
    }
}
