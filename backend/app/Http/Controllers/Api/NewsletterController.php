<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendNewsletterConfirmationJob;
use App\Models\NewsletterSubscriber;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class NewsletterController extends Controller
{
    public function subscribe(Request $request): array
    {
        $validated = Validator::make($request->all(), [
            'email' => 'required|email|max:255',
        ])->validate();

        $email = strtolower(trim($validated['email']));
        $subscriber = NewsletterSubscriber::query()->where('email', $email)->first();

        if (! $subscriber) {
            $subscriber = NewsletterSubscriber::query()->createOrFirst(
                ['email' => $email],
                [
                    'status' => NewsletterSubscriber::STATUS_PENDING,
                    'mail_status' => NewsletterSubscriber::MAIL_PENDING,
                ],
            );
        }

        if ($subscriber->status === NewsletterSubscriber::STATUS_SUBSCRIBED) {
            return ['message' => 'This email is already subscribed.'];
        }

        $staleUndispatched = $subscriber->mail_status === NewsletterSubscriber::MAIL_PENDING
            && $subscriber->created_at?->lt(now()->subMinute());

        if ($subscriber->wasRecentlyCreated
            || $subscriber->status === NewsletterSubscriber::STATUS_UNSUBSCRIBED
            || $subscriber->mail_status === NewsletterSubscriber::MAIL_FAILED
            || $staleUndispatched) {
            $this->queueConfirmation($subscriber);
        }

        return ['message' => 'Check your email to confirm your subscription.'];
    }

    public function confirm(NewsletterSubscriber $subscriber, string $token): RedirectResponse
    {
        abort_unless($subscriber->confirmation_token_hash
            && hash_equals($subscriber->confirmation_token_hash, hash('sha256', $token)), 403);
        abort_if(! $subscriber->confirmation_expires_at || $subscriber->confirmation_expires_at->isPast(), 403);
        abort_unless(in_array($subscriber->status, [
            NewsletterSubscriber::STATUS_PENDING,
            NewsletterSubscriber::STATUS_SUBSCRIBED,
        ], true), 403);

        if ($subscriber->status === NewsletterSubscriber::STATUS_PENDING) {
            $subscriber->update([
                'status' => NewsletterSubscriber::STATUS_SUBSCRIBED,
                'confirmed_at' => now(),
            ]);
        }

        return redirect()->away(rtrim(config('app.frontend_url'), '/').'/?newsletter=confirmed');
    }

    public function unsubscribe(NewsletterSubscriber $subscriber, string $token): RedirectResponse
    {
        abort_unless($subscriber->unsubscribe_token_hash
            && hash_equals($subscriber->unsubscribe_token_hash, hash('sha256', $token)), 403);

        if ($subscriber->status !== NewsletterSubscriber::STATUS_UNSUBSCRIBED) {
            $subscriber->update(['status' => NewsletterSubscriber::STATUS_UNSUBSCRIBED]);
        }

        return redirect()->away(rtrim(config('app.frontend_url'), '/').'/?newsletter=unsubscribed');
    }

    private function queueConfirmation(NewsletterSubscriber $subscriber): void
    {
        $confirmationToken = Str::random(64);
        $unsubscribeToken = Str::random(64);
        $subscriber->update([
            'status' => NewsletterSubscriber::STATUS_PENDING,
            'confirmation_token' => $confirmationToken,
            'confirmation_token_hash' => hash('sha256', $confirmationToken),
            'confirmation_expires_at' => now()->addHours(48),
            'confirmed_at' => null,
            'unsubscribe_token' => $unsubscribeToken,
            'unsubscribe_token_hash' => hash('sha256', $unsubscribeToken),
            'mail_status' => $subscriber->mail_attempts > 0
                ? NewsletterSubscriber::MAIL_RETRIED
                : NewsletterSubscriber::MAIL_QUEUED,
            'mail_last_error' => null,
            'mail_failed_at' => null,
        ]);

        SendNewsletterConfirmationJob::dispatch($subscriber->id)->afterCommit();
    }
}
