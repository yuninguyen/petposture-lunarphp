<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\LoginRequest;
use App\Http\Requests\Api\RegisterRequest;
use App\Http\Resources\Api\UserResource;
use App\Models\User;
use App\Traits\HttpResponses;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

class AuthController extends Controller
{
    use HttpResponses;

    public function login(LoginRequest $request)
    {
        $request->authenticate();

        $user = Auth::user();

        return $this->success([
            'user' => new UserResource($user),
            'token' => $user->createToken('Api Token of ' . $user->name)->plainTextToken
        ], 'Đăng nhập thành công');
    }

    public function register(RegisterRequest $request)
    {
        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
        ]);

        // Assign 'customer' role by default
        $customerRole = Role::where('name', 'customer')->first();
        if ($customerRole) {
            $user->assignRole($customerRole);
        }

        return $this->success([
            'user' => new UserResource($user),
            'token' => $user->createToken('Api Token of ' . $user->name)->plainTextToken
        ], 'Đăng ký thành công');
    }

    public function logout()
    {
        Auth::user()->currentAccessToken()->delete();

        return $this->success(null, 'Đã đăng xuất');
    }

    public function me()
    {
        return $this->success(new UserResource(Auth::user()));
    }
}
