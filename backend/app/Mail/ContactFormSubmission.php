<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class ContactFormSubmission extends Mailable
{
    public function __construct(
        public readonly string $senderName,
        public readonly string $senderEmail,
        public readonly string $messageSubject,
        public readonly string $message,
        public readonly ?string $orderNumber = null,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "[Contact] {$this->messageSubject}",
            replyTo: [$this->senderEmail],
        );
    }

    public function content(): Content
    {
        return new Content(markdown: 'mail.contact-form');
    }
}
