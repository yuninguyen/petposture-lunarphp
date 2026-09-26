<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Security\AdminAbilityRegistry;
use App\Security\AdminPermissionMatrix;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Role;

class RoleController extends Controller
{
    /**
     * Set of managed permissions: assignable abilities from AdminAbilityRegistry
     * (excluding profile & notifications which are not gated, and legacy :: permissions)
     * merged with AdminPermissionMatrix::allPermissions().
     *
     * @return list<string>
     */
    public static function managedPermissions(): array
    {
        $registryAbilities = collect(AdminAbilityRegistry::domains())
            ->reject(fn (array $d) => in_array($d['key'], ['profile', 'notifications'], true))
            ->flatMap(fn (array $d) => $d['abilities'])
            ->reject(fn (string $ability) => str_contains($ability, '::'))
            ->all();

        $all = array_values(array_unique(array_merge($registryAbilities, AdminPermissionMatrix::allPermissions())));
        sort($all);

        return $all;
    }

    public static function domainLabel(string $key): string
    {
        $custom = [
            'dashboard/sales' => 'Dashboard Sales',
            'dashboard/conversion' => 'Dashboard Conversion',
            'goals' => 'Goals',
            'system/users' => 'System Users',
            'system/media' => 'System Media',
            'system/roles' => 'System Roles',
            'system/activity-logs' => 'Activity Logs',
            'affiliate/reports' => 'Affiliate Reports',
            'affiliate/networks' => 'Affiliate Networks',
            'brands' => 'Brands',
            'collection-groups' => 'Collection Groups',
            'collections' => 'Collections',
            'products' => 'Products',
            'product-types' => 'Product Types',
            'custom-fields' => 'Custom Fields',
            'breeds' => 'Breeds',
            'solutions' => 'Solutions',
            'reviews' => 'Reviews',
            'posts' => 'Posts',
            'blog/categories' => 'Blog Categories',
            'comments' => 'Comments',
            'blog/tags' => 'Blog Tags',
            'users' => 'Users',
            'orders' => 'Orders',
            'return-requests' => 'Return Requests',
            'media' => 'Media Library',
            'affiliate-networks' => 'Affiliate Networks Selector',
            'seo-social' => 'SEO & Social',
            'pages' => 'Pages',
            'customers' => 'Customers',
            'settings/general' => 'General Settings',
            'settings/branding' => 'Branding Settings',
            'settings/analytics' => 'Analytics Settings',
            'settings/smtp' => 'SMTP Settings',
            'settings/ai' => 'AI Settings',
            'finance/payment-methods' => 'Payment Methods',
            'shipping-methods' => 'Shipping Methods',
            'discounts' => 'Discounts',
        ];

        return $custom[$key] ?? ucwords(str_replace(['/', '-', '_'], ' ', $key));
    }

    public function index(): JsonResponse
    {
        $roles = Role::query()->whereIn('name', User::ADMIN_PANEL_ROLES)->with('permissions')->get();
        $managed = self::managedPermissions();

        $domainGroups = collect(AdminAbilityRegistry::domains())
            ->reject(fn (array $d) => in_array($d['key'], ['profile', 'notifications'], true))
            ->map(fn (array $d) => [
                'key' => $d['key'],
                'label' => self::domainLabel($d['key']),
                'abilities' => array_values(array_filter($d['abilities'], fn (string $a) => ! str_contains($a, '::'))),
            ])
            ->values()
            ->all();

        return response()->json([
            'data' => $roles->map(fn (Role $role) => [
                'id' => $role->id,
                'name' => $role->name,
                'editable' => ! in_array($role->name, ['super_admin', 'admin', 'staff'], true),
                'permissions' => $role->permissions->pluck('name')->intersect($managed)->values(),
            ]),
            'permission_groups' => $domainGroups,
        ]);
    }

    public function updatePermissions(Request $request, int $role): JsonResponse
    {
        // Deliberately not using implicit Role $role route-model-binding: Spatie's
        // Role::findById() (used internally by binding resolution) filters by guard
        // name, and Auth::shouldUse('sanctum') (triggered by the auth:sanctum
        // middleware on this request) mutates config('auth.defaults.guard') for the
        // rest of the request, causing guard-mismatched lookups against roles that
        // are always seeded under guard_name 'web'. A plain findOrFail sidesteps it.
        $role = Role::query()->findOrFail($role);

        if (in_array($role->name, ['super_admin', 'admin', 'staff'], true)) {
            abort(403, 'This role always has full access and cannot be edited.');
        }
        if (! in_array($role->name, User::ADMIN_PANEL_ROLES, true)) {
            abort(404);
        }

        $managed = self::managedPermissions();

        $validated = $request->validate([
            'permissions' => ['array'],
            'permissions.*' => [Rule::in($managed)],
        ]);

        $currentPermissions = $role->permissions()->pluck('name')->all();
        $unmanagedPermissions = array_values(array_diff($currentPermissions, $managed));
        $payloadPermissions = array_values(array_unique($validated['permissions'] ?? []));

        $finalPermissions = array_values(array_unique(array_merge($unmanagedPermissions, $payloadPermissions)));

        $beforePermissions = collect($currentPermissions)->intersect($managed)->sort()->values()->all();
        $targetPermissions = collect($payloadPermissions)->sort()->values()->all();

        $role->syncPermissions($finalPermissions);

        if ($beforePermissions !== $targetPermissions) {
            activity()
                ->causedBy($request->user())
                ->performedOn($role)
                ->withProperties([
                    'before' => ['permissions' => $beforePermissions],
                    'after' => ['permissions' => $targetPermissions],
                ])
                ->log('permissions_updated');
        }

        return response()->json([
            'data' => [
                'id' => $role->id,
                'name' => $role->name,
                'editable' => true,
                'permissions' => $role->fresh()->permissions->pluck('name')->intersect($managed)->values(),
            ],
        ]);
    }
}
