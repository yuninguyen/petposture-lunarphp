<?php

namespace Tests\Feature;

use App\Jobs\SendContactMessageJob;
use App\Mail\ContactAutoReply;
use App\Mail\ContactFormSubmission;
use App\Models\ContactMessage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class ContactFormReliabilityTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_duplicate_submission_is_persisted_and_queued_only_once_without_inline_mail(): void
    {
        Queue::fake();
        Mail::fake();
        $payload = [
            'name' => 'Casey Customer',
            'email' => 'Casey@example.com',
            'subject' => 'Order question',
            'message' => 'Can you help me with my recent order?',
            'order_number' => 'PP-1001',
            'website' => '',
        ];

        $this->postJson('/api/contact', $payload)->assertOk();
        $this->postJson('/api/contact', $payload)->assertOk();

        Mail::assertNothingSent();
        Queue::assertPushed(SendContactMessageJob::class, 1);
        $this->assertDatabaseCount('contact_messages', 1);
        $this->assertDatabaseHas('contact_messages', [
            'email' => 'casey@example.com',
            'status' => 'received',
        ]);
    }

    public function test_quick_duplicate_across_five_minute_bucket_boundary_is_still_deduplicated(): void
    {
        Queue::fake();
        $payload = [
            'name' => 'Boundary Customer',
            'email' => 'boundary@example.com',
            'subject' => 'Boundary retry',
            'message' => 'This browser retry crossed a bucket boundary.',
            'website' => '',
        ];

        Carbon::setTestNow('2026-08-28 12:04:59');
        $this->postJson('/api/contact', $payload)->assertOk();
        Carbon::setTestNow('2026-08-28 12:05:01');
        $this->postJson('/api/contact', $payload)->assertOk();

        $this->assertDatabaseCount('contact_messages', 1);
        Queue::assertPushed(SendContactMessageJob::class, 1);
    }

    public function test_delivery_job_sends_each_distinct_mail_once_even_when_run_again(): void
    {
        Mail::fake();
        $contact = $this->contactMessage();
        $job = new SendContactMessageJob($contact->id);

        $job->handle();
        $job->handle();

        Mail::assertSent(ContactFormSubmission::class, 1);
        Mail::assertSent(ContactAutoReply::class, 1);
        $contact->refresh();
        $this->assertSame(ContactMessage::STATUS_SENT, $contact->status);
        $this->assertSame(2, $contact->attempts);
        $this->assertNotNull($contact->admin_sent_at);
        $this->assertNotNull($contact->reply_sent_at);
        $this->assertNotNull($contact->sent_at);
    }

    public function test_delivery_failure_is_persisted_for_queue_retry(): void
    {
        $contact = $this->contactMessage();
        Mail::shouldReceive('to')->once()->andThrow(new \RuntimeException('Provider unavailable'));

        $exception = null;
        try {
            (new SendContactMessageJob($contact->id))->handle();
        } catch (\RuntimeException $caught) {
            $exception = $caught;
        }

        $this->assertNotNull($exception, 'Expected mail provider failure.');
        $this->assertSame('Provider unavailable', $exception->getMessage());
        $contact->refresh();
        $this->assertSame(ContactMessage::STATUS_FAILED, $contact->status);
        $this->assertSame(1, $contact->attempts);
        $this->assertSame('Provider unavailable', $contact->last_error);
        $this->assertNotNull($contact->failed_at);
    }

    private function contactMessage(): ContactMessage
    {
        return ContactMessage::query()->create([
            'idempotency_key' => hash('sha256', uniqid('contact', true)),
            'name' => 'Casey Customer',
            'email' => 'casey@example.com',
            'subject' => 'Order question',
            'message' => 'Can you help me?',
            'status' => ContactMessage::STATUS_RECEIVED,
        ]);
    }
}
