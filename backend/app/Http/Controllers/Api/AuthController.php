<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\LoginRequest;
use App\Http\Requests\Api\RegisterRequest;
use App\Http\Resources\Api\UserResource;
use App\Mail\WelcomeEmail;
use App\Models\User;
use App\Notifications\NewCustomerRegisteredNotification;
use App\Services\CartService;
use App\Services\CustomerLinkService;
use App\Traits\HttpResponses;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Spatie\Permission\Models\Role;

class AuthController extends Controller
{
    use HttpResponses;

    public function login(LoginRequest $request)
    {
        $request->authenticate();
        $request->session()->regenerate();

        $user = Auth::user();

        $cartToken = $request->input('cart_token');
        if ($cartToken) {
            app(CartService::class)->mergeGuestCart((string) $cartToken, $user->id);
        }

        return $this->success([
            'user' => new UserResource($user),
        ], 'Đăng nhập thành công');
    }

    public function register(RegisterRequest $request)
    {
        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
        ]);

        $customerRole = Role::where('name', 'customer')->first();
        if ($customerRole) {
            $user->assignRole($customerRole);
        }

        try {
            app(CustomerLinkService::class)->resolveForUser($user);
        } catch (\Throwable $e) {
            Log::error('Customer link failed for user '.$user->id.': '.$e->getMessage());
        }

        try {
            Mail::send(new WelcomeEmail($user));
        } catch (\Throwable $e) {
            Log::error('Welcome email failed for user '.$user->id.': '.$e->getMessage());
        }

        Notification::send(User::staffRecipients(), new NewCustomerRegisteredNotification($user));

        Auth::login($user);
        $request->session()->regenerate();

        return $this->success([
            'user' => new UserResource($user),
        ], 'Đăng ký thành công');
    }

    public function logout(Request $request)
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return $this->success(null, 'Đã đăng xuất');
    }

    public function me()
    {
        $user = Auth::user();

        return $this->success($user ? new UserResource($user) : null);
    }
}
