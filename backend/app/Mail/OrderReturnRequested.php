<?php

namespace App\Mail;

use App\Models\OrderReturnRequest;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class OrderReturnRequested extends Mailable
{
    public function __construct(public readonly OrderReturnRequest $returnRequest) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            to:      $this->returnRequest->order->customer_reference,
            subject: "Your Return Request for " . config('app.name') . " Order #{$this->returnRequest->order->reference} Has Been Received",
        );
    }

    public function content(): Content
    {
        return new Content(view: 'mail.order-return-requested');
    }
}
