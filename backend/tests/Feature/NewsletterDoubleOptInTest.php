<?php

namespace Tests\Feature;

use App\Jobs\SendNewsletterConfirmationJob;
use App\Mail\NewsletterConfirmation;
use App\Models\NewsletterSubscriber;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

class NewsletterDoubleOptInTest extends TestCase
{
    use RefreshDatabase;

    public function test_signup_stays_pending_and_queues_confirmation_without_inline_mail(): void
    {
        Queue::fake();
        Mail::fake();

        $this->postJson('/api/newsletter/subscribe', [
            'email' => 'Subscriber@Example.com',
        ])->assertOk();

        Mail::assertNothingSent();
        Queue::assertPushed(SendNewsletterConfirmationJob::class, 1);
        $this->assertDatabaseHas('newsletter_subscribers', [
            'email' => 'subscriber@example.com',
            'status' => 'pending',
            'mail_status' => 'queued',
        ]);
    }

    public function test_confirmation_job_sends_once_and_records_delivery(): void
    {
        Mail::fake();
        [$subscriber, $job] = $this->pendingSubscriber();

        $job->handle();
        $job->handle();

        Mail::assertSent(NewsletterConfirmation::class, 1);
        $mailable = Mail::sent(NewsletterConfirmation::class)->first();
        $this->assertStringContainsString('Confirm Subscription', $mailable->render());
        $this->assertStringContainsString('available only after confirmation', $mailable->render());
        $subscriber->refresh();
        $this->assertSame(NewsletterSubscriber::MAIL_SENT, $subscriber->mail_status);
        $this->assertSame(1, $subscriber->mail_attempts);
        $this->assertNotNull($subscriber->mail_sent_at);
    }

    public function test_valid_signed_confirmation_subscribes_exactly_once(): void
    {
        [$subscriber, $job] = $this->pendingSubscriber();
        $url = URL::temporarySignedRoute('newsletter.confirm', now()->addHour(), [
            'subscriber' => $subscriber->id,
            'token' => $subscriber->confirmation_token,
        ]);

        $this->get($url)->assertRedirect(config('app.frontend_url').'/?newsletter=confirmed');
        $confirmedAt = $subscriber->refresh()->confirmed_at;
        $this->assertSame(NewsletterSubscriber::STATUS_SUBSCRIBED, $subscriber->status);
        $this->assertNotNull($confirmedAt);

        $this->get($url)->assertRedirect(config('app.frontend_url').'/?newsletter=confirmed');
        $this->assertTrue($confirmedAt->equalTo($subscriber->refresh()->confirmed_at));
    }

    public function test_invalid_or_expired_confirmation_cannot_subscribe(): void
    {
        [$subscriber] = $this->pendingSubscriber();
        $wrongTokenUrl = URL::temporarySignedRoute('newsletter.confirm', now()->addHour(), [
            'subscriber' => $subscriber->id,
            'token' => 'wrong-token',
        ]);
        $expiredUrl = URL::temporarySignedRoute('newsletter.confirm', now()->subMinute(), [
            'subscriber' => $subscriber->id,
            'token' => 'wrong-token',
        ]);

        $this->get($wrongTokenUrl)->assertForbidden();
        $this->get($expiredUrl)->assertForbidden();
        $this->assertSame(NewsletterSubscriber::STATUS_PENDING, $subscriber->refresh()->status);
    }

    public function test_signed_unsubscribe_is_token_bound_and_idempotent(): void
    {
        [$subscriber, $job] = $this->pendingSubscriber();
        $subscriber->update(['status' => NewsletterSubscriber::STATUS_SUBSCRIBED]);
        $url = URL::signedRoute('newsletter.unsubscribe', [
            'subscriber' => $subscriber->id,
            'token' => $subscriber->unsubscribe_token,
        ]);

        $this->get($url)->assertRedirect(config('app.frontend_url').'/?newsletter=unsubscribed');
        $this->get($url)->assertRedirect(config('app.frontend_url').'/?newsletter=unsubscribed');
        $this->assertSame(NewsletterSubscriber::STATUS_UNSUBSCRIBED, $subscriber->refresh()->status);

        $confirmationUrl = URL::temporarySignedRoute('newsletter.confirm', now()->addHour(), [
            'subscriber' => $subscriber->id,
            'token' => $subscriber->confirmation_token,
        ]);
        $this->get($confirmationUrl)->assertForbidden();
    }

    public function test_confirmation_mail_failure_is_durable_and_retryable_on_signup(): void
    {
        $confirmationToken = str_repeat('c', 64);
        $unsubscribeToken = str_repeat('u', 64);
        $subscriber = NewsletterSubscriber::query()->create([
            'email' => 'subscriber@example.com',
            'status' => NewsletterSubscriber::STATUS_PENDING,
            'confirmation_token' => $confirmationToken,
            'confirmation_token_hash' => hash('sha256', $confirmationToken),
            'confirmation_expires_at' => now()->addHours(48),
            'unsubscribe_token' => $unsubscribeToken,
            'unsubscribe_token_hash' => hash('sha256', $unsubscribeToken),
            'mail_status' => NewsletterSubscriber::MAIL_QUEUED,
        ]);
        $job = new SendNewsletterConfirmationJob($subscriber->id);
        Mail::shouldReceive('to')->once()->andThrow(new \RuntimeException('Provider unavailable'));

        try {
            $job->handle();
        } catch (\RuntimeException) {
        }

        $subscriber->refresh();
        $this->assertSame(NewsletterSubscriber::MAIL_FAILED, $subscriber->mail_status);
        $this->assertSame('Provider unavailable', $subscriber->mail_last_error);
        $this->assertNotNull($subscriber->mail_failed_at);

        Queue::fake();
        $this->postJson('/api/newsletter/subscribe', ['email' => $subscriber->email])->assertOk();
        Queue::assertPushed(SendNewsletterConfirmationJob::class, 1);
        $this->assertSame(NewsletterSubscriber::MAIL_RETRIED, $subscriber->refresh()->mail_status);

        Mail::fake();
        $job->handle();
        $sent = Mail::sent(NewsletterConfirmation::class)->first();
        $this->assertNotNull($sent);
        $this->get($sent->confirmationUrl)
            ->assertRedirect(config('app.frontend_url').'/?newsletter=confirmed');
    }

    private function pendingSubscriber(): array
    {
        Queue::fake();
        $queuedJob = null;
        $this->postJson('/api/newsletter/subscribe', ['email' => 'subscriber@example.com'])->assertOk();
        Queue::assertPushed(SendNewsletterConfirmationJob::class, function (SendNewsletterConfirmationJob $job) use (&$queuedJob): bool {
            $queuedJob = $job;

            return true;
        });

        return [NewsletterSubscriber::query()->firstOrFail(), $queuedJob];
    }
}
