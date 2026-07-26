<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Lunar\Models\Order;

class PaymentFailureAlertAdmin extends Mailable
{
    public function __construct(
        public readonly Order $order,
        public readonly int $failureCount,
        public readonly int $windowSeconds,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "[Alert] Payment failing on order #{$this->order->reference} — ".config('app.name'),
        );
    }

    public function content(): Content
    {
        return new Content(view: 'mail.payment-failure-alert-admin');
    }
}
