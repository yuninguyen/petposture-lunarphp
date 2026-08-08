<?php

namespace App\Http\Requests\Api;

use App\Models\User;
use App\Rules\Turnstile;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules;

class RegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', 'unique:'.User::class],
            'password' => ['required', Rules\Password::defaults()],
            'cf_turnstile_token' => ['nullable', 'string', new Turnstile($this->ip())],
        ];
    }
}
