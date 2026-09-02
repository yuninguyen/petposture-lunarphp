<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Lunar\Models\Order;

class TrackingLinkResend extends Mailable
{
    public function __construct(
        public readonly Order $order,
        public readonly string $trackingToken,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            to: $this->order->customer_reference,
            subject: 'Your '.config('app.name')." Order #{$this->order->reference} Tracking Link",
        );
    }

    public function content(): Content
    {
        $trackingUrl = rtrim(config('app.frontend_url'), '/')
            .'/checkout/success?token='.urlencode($this->trackingToken)
            .'&email='.urlencode((string) $this->order->customer_reference);

        return new Content(view: 'mail.tracking-link-resend', with: [
            'trackingUrl' => $trackingUrl,
        ]);
    }
}
