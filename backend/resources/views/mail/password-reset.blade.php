<x-mail::message>
# Reset Your Password

Hi {{ $userName }},

We received a request to reset your {{ config('app.name') }} password. Click the button below to choose a new one.

<x-mail::button url="{{ $resetUrl }}">
Reset Password
</x-mail::button>

This link will expire in **60 minutes**.

If you didn't request a password reset, you can safely ignore this email — your password will remain unchanged.

Thanks,<br>
{{ config('app.name') }}
</x-mail::message>
