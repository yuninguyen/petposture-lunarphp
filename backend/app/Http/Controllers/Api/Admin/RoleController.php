<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Security\AdminPermissionMatrix;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Role;

class RoleController extends Controller
{
    public function index(): JsonResponse
    {
        $roles = Role::query()->whereIn('name', User::ADMIN_PANEL_ROLES)->with('permissions')->get();

        return response()->json([
            'data' => $roles->map(fn (Role $role) => [
                'id' => $role->id,
                'name' => $role->name,
                'editable' => !in_array($role->name, ['super_admin', 'admin', 'staff'], true),
                'permissions' => $role->permissions->pluck('name')->intersect(AdminPermissionMatrix::allPermissions())->values(),
            ]),
            'permission_groups' => [
                'PRODUCT' => AdminPermissionMatrix::PRODUCT,
                'ORDER' => AdminPermissionMatrix::ORDER,
                'REVIEW' => AdminPermissionMatrix::REVIEW,
                'POST' => AdminPermissionMatrix::POST,
            ],
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
        if (!in_array($role->name, User::ADMIN_PANEL_ROLES, true)) {
            abort(404);
        }

        $validated = $request->validate([
            'permissions' => ['array'],
            'permissions.*' => [Rule::in(AdminPermissionMatrix::allPermissions())],
        ]);

        $role->syncPermissions($validated['permissions'] ?? []);

        return response()->json([
            'data' => [
                'id' => $role->id,
                'name' => $role->name,
                'editable' => true,
                'permissions' => $role->fresh()->permissions->pluck('name')->values(),
            ],
        ]);
    }
}
