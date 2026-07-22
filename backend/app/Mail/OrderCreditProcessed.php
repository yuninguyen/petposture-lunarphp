<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Lunar\Models\Order;

class OrderCreditProcessed extends Mailable
{
    public function __construct(public readonly Order $order) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            to:      $this->order->customer_reference,
            subject: "Your " . config('app.name') . " Credit Has Been Processed",
        );
    }

    public function content(): Content
    {
        return new Content(view: 'mail.order-credit-processed');
    }
}
