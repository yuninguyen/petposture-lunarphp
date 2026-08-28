<?php

namespace App\Jobs;

use App\Mail\ContactAutoReply;
use App\Mail\ContactFormSubmission;
use App\Models\ContactMessage;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Mail;
use Throwable;

class SendContactMessageJob implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $uniqueFor = 600;

    public function __construct(public readonly int $contactMessageId) {}

    public function uniqueId(): string
    {
        return (string) $this->contactMessageId;
    }

    public function backoff(): array
    {
        return [60, 300];
    }

    public function handle(): void
    {
        $contact = ContactMessage::query()->findOrFail($this->contactMessageId);
        $contact->increment('attempts');
        $contact->update([
            'status' => $contact->attempts > 1 ? ContactMessage::STATUS_RETRIED : ContactMessage::STATUS_QUEUED,
            'last_error' => null,
            'failed_at' => null,
        ]);

        try {
            if (! $contact->admin_sent_at) {
                Mail::to('support@petposture.com')->send(new ContactFormSubmission(
                    senderName: $contact->name,
                    senderEmail: $contact->email,
                    messageSubject: $contact->subject,
                    messageBody: $contact->message,
                    orderNumber: $contact->order_number,
                ));
                $contact->update(['admin_sent_at' => now()]);
            }

            if (! $contact->reply_sent_at) {
                Mail::to($contact->email)->send(new ContactAutoReply(
                    senderName: $contact->name,
                    originalSubject: $contact->subject,
                ));
                $contact->update(['reply_sent_at' => now()]);
            }

            $contact->update([
                'status' => ContactMessage::STATUS_SENT,
                'sent_at' => now(),
            ]);
        } catch (Throwable $exception) {
            $contact->update([
                'status' => ContactMessage::STATUS_FAILED,
                'last_error' => mb_substr($exception->getMessage(), 0, 2000),
                'failed_at' => now(),
            ]);

            throw $exception;
        }
    }

    public function failed(?Throwable $exception): void
    {
        ContactMessage::query()->whereKey($this->contactMessageId)->update([
            'status' => ContactMessage::STATUS_FAILED,
            'last_error' => $exception ? mb_substr($exception->getMessage(), 0, 2000) : 'Contact mail delivery failed.',
            'failed_at' => now(),
        ]);
    }
}
