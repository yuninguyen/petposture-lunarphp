<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class NewsletterConfirmation extends Mailable
{
    public function __construct(
        public readonly string $email,
        public readonly string $confirmationUrl,
        public readonly string $unsubscribeUrl,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            to: $this->email,
            subject: 'Confirm your '.config('app.name').' subscription',
        );
    }

    public function content(): Content
    {
        return new Content(view: 'mail.newsletter-confirmation');
    }
}
