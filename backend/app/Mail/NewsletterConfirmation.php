<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class NewsletterConfirmation extends Mailable
{
    public function __construct(public readonly string $email) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            to:      $this->email,
            subject: 'You\'re subscribed to ' . config('app.name') . '!',
        );
    }

    public function content(): Content
    {
        return new Content(markdown: 'mail.newsletter-confirmation');
    }
}
