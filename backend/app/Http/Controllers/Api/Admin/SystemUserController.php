<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\ErrorCode;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreSystemUserRequest;
use App\Http\Requests\Admin\UpdateSystemUserRequest;
use App\Http\Resources\Admin\SystemUserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Hash;

class SystemUserController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        $users = User::query()
            ->whereHas('roles', fn ($q) => $q->whereIn('name', User::ADMIN_PANEL_ROLES))
            ->with('roles')
            ->orderBy('name')
            ->get();

        return SystemUserResource::collection($users);
    }

    public function store(StoreSystemUserRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'is_active' => $request->boolean('is_active', true),
        ]);

        $user->syncRoles($validated['roles']);

        activity()
            ->causedBy($request->user())
            ->performedOn($user)
            ->withProperties([
                'after' => [
                    'name' => $user->name,
                    'email' => $user->email,
                    'roles' => $user->roles()->pluck('name')->sort()->values()->all(),
                    'is_active' => (bool) $user->is_active,
                ],
            ])
            ->log('created');

        return (new SystemUserResource($user->load('roles')))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    public function show(User $user): SystemUserResource
    {
        abort_unless($user->hasAnyRole(User::ADMIN_PANEL_ROLES), Response::HTTP_NOT_FOUND);

        return new SystemUserResource($user->load('roles'));
    }

    public function update(UpdateSystemUserRequest $request, User $user): JsonResponse|SystemUserResource
    {
        abort_unless($user->hasAnyRole(User::ADMIN_PANEL_ROLES), Response::HTTP_NOT_FOUND);

        // Guard 1: Cannot disable own account
        if ($request->user()->id === $user->id) {
            if ($request->has('is_active') && $request->boolean('is_active') === false) {
                return response()->json([
                    'code' => ErrorCode::CANNOT_MODIFY_SELF->value,
                    'message' => 'You cannot disable or delete your own account.',
                ], Response::HTTP_CONFLICT);
            }
        }

        // Guard 2: Cannot remove the last active super admin
        if ($user->hasRole('super_admin')) {
            $isLosingSuperAdmin = ($request->has('is_active') && $request->boolean('is_active') === false)
                || ($request->has('roles') && !in_array('super_admin', $request->input('roles', [])));

            if ($isLosingSuperAdmin) {
                $activeSuperAdminCount = User::role('super_admin')->where('is_active', true)->count();
                if ($activeSuperAdminCount <= 1) {
                    return response()->json([
                        'code' => ErrorCode::LAST_SUPER_ADMIN->value,
                        'message' => 'Cannot remove the last active super admin.',
                    ], Response::HTTP_CONFLICT);
                }
            }
        }

        $before = [
            'name' => $user->name,
            'email' => $user->email,
            'roles' => $user->roles->pluck('name')->sort()->values()->all(),
            'is_active' => (bool) $user->is_active,
        ];

        $validated = $request->validated();
        $data = [
            'name' => $validated['name'],
            'email' => $validated['email'],
        ];

        if ($request->has('is_active')) {
            $data['is_active'] = $request->boolean('is_active');
        }

        if (!empty($validated['password'])) {
            $data['password'] = Hash::make($validated['password']);
        }

        $user->update($data);

        if ($request->has('roles')) {
            // Preserve any role outside the 6 admin-panel roles (e.g. `customer`)
            // that this account may also hold — the form only ever submits the
            // fixed admin-role subset, and a plain syncRoles() would silently
            // strip roles never offered as a checkbox.
            $nonAdminRoles = $user->roles->pluck('name')->diff(User::ADMIN_PANEL_ROLES)->all();
            $user->syncRoles([...$validated['roles'], ...$nonAdminRoles]);
        }

        $afterUser = $user->fresh(['roles']);
        $after = [
            'name' => $afterUser->name,
            'email' => $afterUser->email,
            'roles' => $afterUser->roles->pluck('name')->sort()->values()->all(),
            'is_active' => (bool) $afterUser->is_active,
        ];

        $diffBefore = [];
        $diffAfter = [];
        foreach ($before as $key => $val) {
            if ($val !== $after[$key]) {
                $diffBefore[$key] = $val;
                $diffAfter[$key] = $after[$key];
            }
        }

        if (! empty($diffBefore)) {
            activity()
                ->causedBy($request->user())
                ->performedOn($user)
                ->withProperties([
                    'before' => $diffBefore,
                    'after' => $diffAfter,
                ])
                ->log('updated');
        }

        return new SystemUserResource($user->load('roles'));
    }

    public function destroy(Request $request, User $user): Response|JsonResponse
    {
        abort_unless($user->hasAnyRole(User::ADMIN_PANEL_ROLES), Response::HTTP_NOT_FOUND);

        // Guard 1: Cannot delete own account
        if ($request->user()->id === $user->id) {
            return response()->json([
                'code' => ErrorCode::CANNOT_MODIFY_SELF->value,
                'message' => 'You cannot disable or delete your own account.',
            ], Response::HTTP_CONFLICT);
        }

        // Guard 2: Cannot delete last active super admin
        if ($user->hasRole('super_admin')) {
            $activeSuperAdminCount = User::role('super_admin')->where('is_active', true)->count();
            if ($activeSuperAdminCount <= 1) {
                return response()->json([
                    'code' => ErrorCode::LAST_SUPER_ADMIN->value,
                    'message' => 'Cannot remove the last active super admin.',
                ], Response::HTTP_CONFLICT);
            }
        }

        $userSnapshot = [
            'name' => $user->name,
            'email' => $user->email,
            'roles' => $user->roles->pluck('name')->sort()->values()->all(),
            'is_active' => (bool) $user->is_active,
        ];

        $user->syncRoles([]);
        $user->delete();

        activity()
            ->causedBy($request->user())
            ->performedOn($user)
            ->withProperties([
                'before' => $userSnapshot,
            ])
            ->log('deleted');

        return response()->noContent();
    }
}
