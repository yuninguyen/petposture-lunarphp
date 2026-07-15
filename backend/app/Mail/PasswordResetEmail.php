<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class PasswordResetEmail extends Mailable
{
    public function __construct(
        public readonly string $userName,
        public readonly string $resetUrl,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Reset your ' . config('app.name') . ' password',
        );
    }

    public function content(): Content
    {
        return new Content(markdown: 'mail.password-reset');
    }
}
