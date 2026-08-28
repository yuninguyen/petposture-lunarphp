<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendContactMessageJob;
use App\Models\ContactMessage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class ContactController extends Controller
{
    public function submit(Request $request): JsonResponse
    {
        $validated = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255',
            'subject' => 'required|string|max:255',
            'message' => 'required|string|max:5000',
            'order_number' => 'nullable|string|max:100',
            'website' => 'nullable|string|max:255',
        ])->validate();

        if (! empty($validated['website'])) {
            Log::info('Contact form spam blocked (honeypot)', ['ip' => $request->ip(), 'email' => $validated['email']]);

            return $this->acceptedResponse();
        }

        $email = strtolower(trim($validated['email']));
        $fingerprint = implode("\0", [
            $email,
            trim($validated['subject']),
            trim($validated['message']),
            trim((string) ($validated['order_number'] ?? '')),
        ]);
        $bucket = intdiv(now()->timestamp, 300);
        $idempotencyKeys = [
            hash('sha256', $fingerprint."\0".$bucket),
            hash('sha256', $fingerprint."\0".($bucket - 1)),
        ];

        $contact = ContactMessage::query()
            ->whereIn('idempotency_key', $idempotencyKeys)
            ->where('created_at', '>=', now()->subMinutes(5))
            ->first();

        $contact ??= ContactMessage::query()->createOrFirst(
            ['idempotency_key' => $idempotencyKeys[0]],
            [
                'name' => trim($validated['name']),
                'email' => $email,
                'subject' => trim($validated['subject']),
                'message' => trim($validated['message']),
                'order_number' => isset($validated['order_number']) ? trim($validated['order_number']) : null,
                'status' => ContactMessage::STATUS_RECEIVED,
            ],
        );

        if ($contact->wasRecentlyCreated) {
            SendContactMessageJob::dispatch($contact->id)->afterCommit();
        }

        Log::info('Contact form accepted', [
            'contact_message_id' => $contact->id,
            'duplicate' => ! $contact->wasRecentlyCreated,
            'ip' => $request->ip(),
        ]);

        return $this->acceptedResponse();
    }

    private function acceptedResponse(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'Your message has been sent. We\'ll get back to you within 24 hours.',
        ]);
    }
}
