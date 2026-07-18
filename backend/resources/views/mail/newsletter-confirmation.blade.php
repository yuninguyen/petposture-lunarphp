<x-mail::message :message="$message ?? null">
# You're in! 🎉

Thanks for subscribing to {{ config('app.name') }} updates.

You'll be the first to hear about:

- New product launches
- Exclusive discounts and promotions
- Pet health & posture tips

<x-mail::button url="{{ config('app.frontend_url') }}/shop">
Shop Now
</x-mail::button>

If you didn't subscribe, you can safely ignore this email.

Thanks,<br>
{{ config('app.name') }}
</x-mail::message>
