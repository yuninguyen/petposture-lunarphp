<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\NewsletterConfirmation;
use App\Models\NewsletterSubscriber;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Validator;

class NewsletterController extends Controller
{
    public function subscribe(Request $request): array
    {
        $validated = Validator::make($request->all(), [
            'email' => 'required|email|max:255',
        ])->validate();

        $email = $validated['email'];
        $existing = NewsletterSubscriber::where('email', $email)->first();

        if ($existing) {
            if ($existing->status === 'unsubscribed') {
                $existing->update(['status' => 'subscribed']);
                Mail::send(new NewsletterConfirmation($email));
                return ['message' => 'You have been resubscribed.'];
            }
            return ['message' => 'This email is already subscribed.'];
        }

        NewsletterSubscriber::create(['email' => $email, 'status' => 'subscribed']);
        Mail::send(new NewsletterConfirmation($email));

        return ['message' => 'Successfully subscribed!'];
    }
}
