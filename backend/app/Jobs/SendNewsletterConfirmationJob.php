<?php

namespace App\Jobs;

use App\Mail\NewsletterConfirmation;
use App\Models\NewsletterSubscriber;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\URL;
use Throwable;

class SendNewsletterConfirmationJob implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $uniqueFor = 600;

    public function __construct(public readonly int $subscriberId) {}

    public function uniqueId(): string
    {
        return (string) $this->subscriberId;
    }

    public function backoff(): array
    {
        return [60, 300];
    }

    public function handle(): void
    {
        $subscriber = NewsletterSubscriber::query()->findOrFail($this->subscriberId);
        if ($subscriber->status !== NewsletterSubscriber::STATUS_PENDING
            || $subscriber->mail_status === NewsletterSubscriber::MAIL_SENT) {
            return;
        }

        $subscriber->increment('mail_attempts');
        $subscriber->update([
            'mail_status' => $subscriber->mail_attempts > 1
                ? NewsletterSubscriber::MAIL_RETRIED
                : NewsletterSubscriber::MAIL_QUEUED,
            'mail_last_error' => null,
            'mail_failed_at' => null,
        ]);

        try {
            Mail::to($subscriber->email)->send(new NewsletterConfirmation(
                email: $subscriber->email,
                confirmationUrl: URL::temporarySignedRoute(
                    'newsletter.confirm',
                    $subscriber->confirmation_expires_at,
                    ['subscriber' => $subscriber->id, 'token' => $subscriber->confirmation_token],
                ),
                unsubscribeUrl: URL::signedRoute('newsletter.unsubscribe', [
                    'subscriber' => $subscriber->id,
                    'token' => $subscriber->unsubscribe_token,
                ]),
            ));

            $subscriber->update([
                'mail_status' => NewsletterSubscriber::MAIL_SENT,
                'mail_sent_at' => now(),
            ]);
        } catch (Throwable $exception) {
            $subscriber->update([
                'mail_status' => NewsletterSubscriber::MAIL_FAILED,
                'mail_last_error' => mb_substr($exception->getMessage(), 0, 2000),
                'mail_failed_at' => now(),
            ]);

            throw $exception;
        }
    }

    public function failed(?Throwable $exception): void
    {
        NewsletterSubscriber::query()->whereKey($this->subscriberId)->update([
            'mail_status' => NewsletterSubscriber::MAIL_FAILED,
            'mail_last_error' => $exception ? mb_substr($exception->getMessage(), 0, 2000) : 'Newsletter confirmation delivery failed.',
            'mail_failed_at' => now(),
        ]);
    }
}
