<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Lunar\Models\Order;

class CancelledOrderAdmin extends Mailable
{
    public function __construct(public readonly Order $order) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "[Cancelled] Order #{$this->order->reference} — " . config('app.name'),
        );
    }

    public function content(): Content
    {
        return new Content(view: 'mail.cancelled-order-admin');
    }
}
