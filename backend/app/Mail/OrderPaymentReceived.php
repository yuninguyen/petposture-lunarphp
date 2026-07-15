<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Lunar\Models\Order;

class OrderPaymentReceived extends Mailable
{
    public function __construct(public readonly Order $order) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            to:      $this->order->customer_reference,
            subject: "Payment confirmed — Order #{$this->order->reference}",
        );
    }

    public function content(): Content
    {
        return new Content(markdown: 'mail.order-payment-received');
    }
}
