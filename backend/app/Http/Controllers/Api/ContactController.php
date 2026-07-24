<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\ContactAutoReply;
use App\Mail\ContactFormSubmission;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Validator;

class ContactController extends Controller
{
    public function submit(Request $request): JsonResponse
    {
        $validated = Validator::make($request->all(), [
            'name'         => 'required|string|max:255',
            'email'        => 'required|email|max:255',
            'subject'      => 'required|string|max:255',
            'message'      => 'required|string|max:5000',
            'order_number' => 'nullable|string|max:100',
        ])->validate();

        $adminEmail = 'support@petposture.com';

        try {
            // Notify admin
            Mail::to($adminEmail)->send(new ContactFormSubmission(
                senderName:     $validated['name'],
                senderEmail:    $validated['email'],
                messageSubject: $validated['subject'],
                messageBody:    $validated['message'],
                orderNumber:    $validated['order_number'] ?? null,
            ));

            // Auto-reply to customer
            Mail::to($validated['email'])->send(new ContactAutoReply(
                senderName:      $validated['name'],
                originalSubject: $validated['subject'],
            ));
        } catch (\Throwable $e) {
            Log::error('Contact form mail failed: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Unable to send your message. Please try again later.',
            ], 500);
        }

        return response()->json([
            'success' => true,
            'message' => 'Your message has been sent. We\'ll get back to you within 24 hours.',
        ]);
    }
}
