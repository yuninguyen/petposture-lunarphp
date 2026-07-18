<x-mail::message :message="$message ?? null">
# We got your message, {{ $senderName }}!

Thanks for reaching out to {{ config('app.name') }}. We've received your message about **"{{ $originalSubject }}"** and our support team will get back to you within **24 business hours**.

In the meantime, you might find answers in our help resources:

<x-mail::button url="{{ config('app.frontend_url') }}/faqs">
Browse FAQs
</x-mail::button>

Thanks,<br>
{{ config('app.name') }}
</x-mail::message>
