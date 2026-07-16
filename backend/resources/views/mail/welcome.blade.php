<x-mail::message>
<x-slot:header>
<x-mail::header :url="config('app.frontend_url')">
<img src="{{ config('app.frontend_url') }}/assets/Logo-PetPosture-1-e1761840892773.png" height="42" alt="{{ config('app.name') }}">
</x-mail::header>
</x-slot:header>

# Welcome aboard, {{ $user->name }}!

Your {{ config('app.name') }} account has been created with the email **{{ $user->email }}**. Here's what you can do next:

- Track every order in real time, from checkout to delivery
- Save shipping addresses for faster checkout
- Browse your full order history in one place

<x-mail::button url="{{ config('app.frontend_url') }}/shop">
Start Shopping
</x-mail::button>

Thanks,<br>
The {{ config('app.name') }} Team

<x-slot:footer>
<x-mail::footer>
© {{ date('Y') }} {{ config('app.name') }}. All rights reserved.<br>
This is an automated message, please don't reply directly to this email.
</x-mail::footer>
</x-slot:footer>
</x-mail::message>
