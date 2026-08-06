<?php

namespace App\Filament\Pages;

use Filament\Pages\Page;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class Permissions extends Page
{
    protected static ?string $navigationIcon = 'heroicon-o-shield-check';

    protected static string $view = 'filament.pages.permissions';

    protected static ?int $navigationSort = 2;

    private static array $actionPrefixes = [
        'view_any', 'force_delete_any', 'force_delete', 'delete_any', 'delete',
        'restore_any', 'restore', 'replicate', 'reorder', 'update', 'create', 'view',
    ];

    public static function getNavigationGroup(): ?string
    {
        return __('System');
    }

    public function getTitle(): string
    {
        return __('Permissions');
    }

    /**
     * Groups every registered permission by its underlying resource, with
     * each row carrying which roles currently grant it — mirrors what
     * Filament Shield already enforces, just laid out for a quick read
     * instead of digging through each role's edit form one at a time.
     */
    public function getMatrix(): array
    {
        $roles = Role::query()->orderBy('name')->get();

        $rolePermissions = $roles->mapWithKeys(
            fn (Role $role) => [$role->id => $role->permissions->pluck('name')->flip()]
        );

        $groups = [];

        foreach (Permission::query()->orderBy('name')->get() as $permission) {
            [$resource, $action] = self::parse($permission->name);

            $groups[$resource]['rows'][] = [
                'label' => $action,
                'name' => $permission->name,
                'roles' => $roles->mapWithKeys(fn (Role $role) => [
                    $role->id => $rolePermissions[$role->id]->has($permission->name),
                ]),
            ];
        }

        ksort($groups);

        return [
            'roles' => $roles,
            'groups' => $groups,
        ];
    }

    private static function parse(string $permission): array
    {
        if (str_contains($permission, ':') && ! str_contains($permission, '_')) {
            [$resource, $action] = explode(':', $permission, 2);

            return [Str::headline($resource), Str::headline(str_replace('-', ' ', $action))];
        }

        foreach (self::$actionPrefixes as $prefix) {
            if (Str::startsWith($permission, $prefix.'_')) {
                $resource = Str::after($permission, $prefix.'_');

                return [Str::headline(str_replace('::', ' ', $resource)), Str::headline($prefix)];
            }
        }

        return [__('Other'), Str::headline($permission)];
    }
}
