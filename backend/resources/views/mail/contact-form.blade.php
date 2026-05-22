<x-mail::message>
# New Contact Form Submission

**From:** {{ $senderName }} &lt;{{ $senderEmail }}&gt;
**Subject:** {{ $subject }}
@if($orderNumber)
**Order #:** {{ $orderNumber }}
@endif

---

{{ $message }}

---

*Reply directly to this email to respond to {{ $senderName }}.*
</x-mail::message>
