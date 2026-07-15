<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class ContactAutoReply extends Mailable
{
    public function __construct(
        public readonly string $senderName,
        public readonly string $subject,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'We received your message — ' . config('app.name'),
        );
    }

    public function content(): Content
    {
        return new Content(markdown: 'mail.contact-auto-reply');
    }
}
