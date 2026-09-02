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
        public readonly string $context = 'tracking',
    ) {}

    public function envelope(): Envelope
    {
        $subjectAction = $this->context === 'returns' ? 'Return Request Link' : 'Tracking Link';

        return new Envelope(
            to: $this->order->customer_reference,
            subject: 'Your '.config('app.name')." Order #{$this->order->reference} {$subjectAction}",
        );
    }

    public function content(): Content
    {
        $path = $this->context === 'returns' ? '/returns' : '/checkout/success';

        $trackingUrl = rtrim(config('app.frontend_url'), '/')
            .$path.'?token='.urlencode($this->trackingToken)
            .'&email='.urlencode((string) $this->order->customer_reference);

        return new Content(view: 'mail.tracking-link-resend', with: [
            'trackingUrl' => $trackingUrl,
            'context' => $this->context,
        ]);
    }
}
