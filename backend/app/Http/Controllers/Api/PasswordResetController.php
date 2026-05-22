<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\PasswordResetEmail;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Validator;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Support\Str;

class PasswordResetController extends Controller
{
    public function sendResetLink(Request $request): JsonResponse
    {
        Validator::make($request->all(), [
            'email' => 'required|email',
        ])->validate();

        $user = User::where('email', $request->email)->first();

        // Always return success to prevent email enumeration
        if (! $user) {
            return response()->json([
                'success' => true,
                'message' => 'If an account exists for that email, a reset link has been sent.',
            ]);
        }

        $token = Password::broker()->createToken($user);
        $resetUrl = config('app.frontend_url') . '/auth/reset-password?token=' . $token . '&email=' . urlencode($user->email);

        try {
            Mail::to($user->email)->send(new PasswordResetEmail(
                userName: $user->name,
                resetUrl: $resetUrl,
            ));
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('Password reset mail failed: ' . $e->getMessage());
        }

        return response()->json([
            'success' => true,
            'message' => 'If an account exists for that email, a reset link has been sent.',
        ]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        Validator::make($request->all(), [
            'token'    => 'required|string',
            'email'    => 'required|email',
            'password' => 'required|string|min:8|confirmed',
        ])->validate();

        $status = Password::broker()->reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) {
                $user->forceFill(['password' => Hash::make($password)])
                     ->setRememberToken(Str::random(60));
                $user->save();
                event(new PasswordReset($user));
            }
        );

        if ($status === Password::PASSWORD_RESET) {
            return response()->json(['success' => true, 'message' => 'Password reset successfully.']);
        }

        return response()->json([
            'success' => false,
            'message' => match ($status) {
                Password::INVALID_TOKEN => 'This reset link is invalid or has expired.',
                Password::INVALID_USER  => 'No account found with that email.',
                default                 => 'Unable to reset password. Please try again.',
            },
        ], 422);
    }
}
