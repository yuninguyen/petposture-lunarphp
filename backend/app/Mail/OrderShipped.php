<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Lunar\Models\Order;

class OrderShipped extends Mailable
{
    public function __construct(public readonly Order $order) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            to:      $this->order->customer_reference,
            subject: "A shipment from order #{$this->order->reference} is on the way",
        );
    }

    public function content(): Content
    {
        return new Content(view: 'mail.order-shipped');
    }
}
