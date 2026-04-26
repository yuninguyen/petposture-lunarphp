<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Comment;
use App\Models\Post;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class CommentController extends Controller
{
    public function index(string $slug): array
    {
        $post = Post::where('slug', $slug)->firstOrFail();
        
        return [
            'comments' => $post->comments()
                ->where('status', 'approved')
                ->orderByDesc('created_at')
                ->get()
                ->map(fn ($c) => [
                    'id' => $c->id,
                    'customer_name' => $c->customer_name,
                    'comment' => $c->comment,
                    'created_at' => $c->created_at->toIso8601String(),
                ])->all(),
        ];
    }

    public function store(Request $request, string $slug): array
    {
        $post = Post::where('slug', $slug)->firstOrFail();

        $validated = Validator::make($request->all(), [
            'customer_name' => 'required|string|max:255',
            'comment' => 'required|string|max:2000',
        ])->validate();

        $comment = $post->comments()->create([
            ...$validated,
            'status' => 'pending', // Requires approval
        ]);

        return [
            'message' => 'Comment submitted for moderation.',
            'comment_id' => $comment->id,
        ];
    }
}