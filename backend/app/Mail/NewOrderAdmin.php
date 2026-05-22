<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Lunar\Models\Order;

class NewOrderAdmin extends Mailable
{
    public function __construct(public readonly Order $order) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "[New Order] #{$this->order->reference} — " . config('app.name'),
        );
    }

    public function content(): Content
    {
        return new Content(view: 'mail.new-order-admin');
    }
}
