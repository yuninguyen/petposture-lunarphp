<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\Admin\CommentResource;
use App\Models\Comment;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

class CommentController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = Comment::with('post');

        if ($request->has('search')) {
            $search = $request->input('search');
            $query->where('customer_name', 'like', "%{$search}%");
        }

        if ($request->has('status')) {
            $status = $request->input('status');
            $query->where('status', $status);
        }

        $perPage = $request->input('per_page', 10);

        $comments = $query->latest()->paginate($perPage);

        return CommentResource::collection($comments);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        Gate::authorize('create', Comment::class);

        $validated = $request->validate([
            'post_id' => 'required|exists:posts,id',
            'customer_name' => 'required|string|max:255',
            'status' => 'required|in:pending,approved,rejected',
            'comment' => 'required|string',
        ]);

        $comment = Comment::create($validated);

        return new CommentResource($comment);
    }

    /**
     * Display the specified resource.
     */
    public function show(Comment $comment)
    {
        $comment->load('post');

        return new CommentResource($comment);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Comment $comment)
    {
        Gate::authorize('update', $comment);

        $validated = $request->validate([
            'post_id' => 'required|exists:posts,id',
            'customer_name' => 'required|string|max:255',
            'status' => 'required|in:pending,approved,rejected',
            'comment' => 'required|string',
        ]);

        $comment->update($validated);

        return new CommentResource($comment);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Comment $comment)
    {
        Gate::authorize('delete', $comment);

        $comment->delete();

        return response()->json(null, Response::HTTP_NO_CONTENT);
    }

    /**
     * Bulk destroy resources.
     */
    public function bulkDestroy(Request $request)
    {
        Gate::authorize('deleteAny', Comment::class);

        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer|exists:comments,id',
        ]);

        Comment::whereIn('id', $validated['ids'])->delete();

        return response()->json(null, Response::HTTP_NO_CONTENT);
    }

    /**
     * Approve a comment quickly.
     */
    public function approve(Comment $comment)
    {
        Gate::authorize('update', $comment);

        $comment->update(['status' => 'approved']);

        return new CommentResource($comment);
    }
}
