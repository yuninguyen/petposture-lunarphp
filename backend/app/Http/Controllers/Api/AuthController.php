<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\LoginRequest;
use App\Http\Requests\Api\RegisterRequest;
use App\Http\Resources\Api\UserResource;
use App\Models\User;
use App\Mail\WelcomeEmail;
use App\Services\CartService;
use App\Traits\HttpResponses;
use Illuminate\Support\Facades\Mail;
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

        $cartToken = $request->input('cart_token');
        if ($cartToken) {
            app(CartService::class)->mergeGuestCart((string) $cartToken, $user->id);
        }

        $plainToken = $user->createToken("Api Token of {$user->name}")->plainTextToken;

        return $this->success([
            'user'  => new UserResource($user),
            'token' => $plainToken,
        ], 'Đăng nhập thành công')->withCookie($this->authCookie($plainToken));
    }

    public function register(RegisterRequest $request)
    {
        $user = User::create([
            'name'     => $request->name,
            'email'    => $request->email,
            'password' => Hash::make($request->password),
        ]);

        $customerRole = Role::where('name', 'customer')->first();
        if ($customerRole) {
            $user->assignRole($customerRole);
        }

        Mail::send(new WelcomeEmail($user));

        $plainToken = $user->createToken("Api Token of {$user->name}")->plainTextToken;

        return $this->success([
            'user'  => new UserResource($user),
            'token' => $plainToken,
        ], 'Đăng ký thành công')->withCookie($this->authCookie($plainToken));
    }

    public function logout()
    {
        Auth::user()->currentAccessToken()->delete();

        return $this->success(null, 'Đã đăng xuất')
            ->withCookie(cookie()->forget('petposture_token'));
    }

    public function me()
    {
        return $this->success(new UserResource(Auth::user()));
    }

    private function authCookie(string $token): \Symfony\Component\HttpFoundation\Cookie
    {
        $isProd     = app()->environment('production');
        $sameSite   = $isProd ? 'none' : 'lax';
        $domain     = config('session.domain');

        return cookie(
            'petposture_token',
            $token,
            60 * 24 * 7,  // 7 days
            '/',
            $domain,
            $isProd,  // Secure flag — only in production (requires HTTPS)
            true,     // httpOnly — JS cannot read this cookie
            false,
            $sameSite
        );
    }
}
