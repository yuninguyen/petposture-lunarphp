<x-mail::message :message="$message ?? null">
# New Contact Form Submission

**From:** {{ $senderName }} &lt;{{ $senderEmail }}&gt;
**Subject:** {{ $messageSubject }}
@if($orderNumber)
**Order #:** {{ $orderNumber }}
@endif

---

{{ $messageBody }}

---

*Reply directly to this email to respond to {{ $senderName }}.*
</x-mail::message>
