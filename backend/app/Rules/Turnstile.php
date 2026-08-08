<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class Turnstile implements ValidationRule
{
    public function __construct(private readonly ?string $remoteIp = null)
    {
    }

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $secret = config('services.cloudflare.turnstile_secret');

        if (blank($secret)) {
            return;
        }

        if (blank($value)) {
            $fail(__('Please complete the verification challenge.'));

            return;
        }

        try {
            $response = Http::asForm()->post('https://challenges.cloudflare.com/turnstile/v0/siteverify', [
                'secret' => $secret,
                'response' => $value,
                'remoteip' => $this->remoteIp,
            ]);

            if (! $response->json('success', false)) {
                $fail(__('Verification failed. Please try again.'));
            }
        } catch (\Throwable $e) {
            Log::error('Turnstile verification request failed: '.$e->getMessage());
            $fail(__('Verification failed. Please try again.'));
        }
    }
}
