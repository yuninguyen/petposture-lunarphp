<x-mail::message>
# Welcome to {{ config('app.name') }}, {{ $user->name }}!

Thanks for creating an account. You can now:

- Track your orders in real time
- Save your shipping address for faster checkout
- View your full order history

<x-mail::button url="{{ config('app.frontend_url') }}/shop">
Start Shopping
</x-mail::button>

If you have any questions, we're always here to help.

Thanks,<br>
{{ config('app.name') }}
</x-mail::message>
