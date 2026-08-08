<?php

namespace App\Http\Requests\Api;

use App\Rules\Turnstile;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
            'cf_turnstile_token' => ['nullable', 'string', new Turnstile($this->ip())],
        ];
    }

    public function authenticate(): void
    {
        if (! Auth::attempt($this->only('email', 'password'))) {
            throw ValidationException::withMessages([
                'email' => __('auth.failed'),
            ]);
        }
    }
}
