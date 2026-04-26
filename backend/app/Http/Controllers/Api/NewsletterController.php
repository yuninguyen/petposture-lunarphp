<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\NewsletterSubscriber;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class NewsletterController extends Controller
{
    public function subscribe(Request $request): array
    {
        $validated = Validator::make($request->all(), [
            'email' => 'required|email|max:255',
        ])->validate();

        $existing = NewsletterSubscriber::where('email', $validated['email'])->first();

        if ($existing) {
            if ($existing->status === 'unsubscribed') {
                $existing->update(['status' => 'subscribed']);
                return ['message' => 'You have been resubscribed.'];
            }
            return ['message' => 'This email is already subscribed.'];
        }

        NewsletterSubscriber::create([
            'email' => $validated['email'],
            'status' => 'subscribed',
        ]);

        return ['message' => 'Successfully subscribed!'];
    }
}