<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\PostResource;
use App\Models\BlogCategory;
use App\Models\Post;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class PostController extends Controller
{
    private function authorizeAdmin(): void
    {
        $user = request()->user();
        if (! $user || ! $user->hasAnyRole(['super_admin', 'admin', 'staff'])) {
            abort(403, 'Forbidden');
        }
    }

    public function index(Request $request)
    {
        $this->authorizeAdmin();

        $query = Post::with(['blogCategory', 'metadata', 'tags', 'seo', 'featuredMedia'])->latest();

        if ($request->has('category')) {
            $query->whereHas('blogCategory', function ($q) use ($request) {
                $q->where('slug', $request->category);
            });
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('search')) {
            $query->where('title', 'like', '%'.$request->search.'%');
        }

        return PostResource::collection($query->paginate(20));
    }

    public function categories()
    {
        $this->authorizeAdmin();

        return response()->json(BlogCategory::all());
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeAdmin();

        $validated = $request->validate($this->validationRules(forUpdate: false));
        $validated['type'] = $validated['type'] ?? Post::TYPE_ARTICLE;
        $validated['status'] = $validated['status'] ?? 'draft';
        $comparison = $this->extractComparisonData($validated);

        // Slug stays optional from the client — generate it when absent (as the
        // original store() did) so older API clients and the admin form keep
        // working without a slug field.
        $validated['slug'] = $validated['slug'] ?? Str::slug($validated['title']).'-'.rand(1000, 9999);

        if ($validated['status'] === 'published') {
            $validated['published_at'] = now();
        }

        $post = Post::create($validated);

        if ($post->type === Post::TYPE_COMPARISON) {
            $this->syncComparisonMeta($post, $comparison);
        }

        return (new PostResource($post->fresh()))->response()->setStatusCode(201);
    }

    public function show(Post $post)
    {
        $this->authorizeAdmin();

        return new PostResource($post->load('blogCategory'));
    }

    public function update(Request $request, Post $post)
    {
        $this->authorizeAdmin();

        $validated = $request->validate($this->validationRules(forUpdate: true));
        $comparison = $this->extractComparisonData($validated);

        if (isset($validated['status']) && $validated['status'] === 'published' && ! $post->published_at) {
            $validated['published_at'] = now();
        }

        $post->update($validated);

        if ($post->type === Post::TYPE_COMPARISON) {
            $this->syncComparisonMeta($post, $comparison);
        }

        return new PostResource($post->fresh());
    }

    public function destroy(Post $post)
    {
        $this->authorizeAdmin();

        $post->delete();

        return response()->json(null, 204);
    }

    protected function validationRules(bool $forUpdate): array
    {
        $slugRule = 'sometimes|required|string|max:255';

        return [
            'blog_category_id' => $forUpdate ? 'sometimes|required|exists:blog_categories,id' : 'required|exists:blog_categories,id',
            'title' => $forUpdate ? 'sometimes|required|string|max:255' : 'required|string|max:255',
            'slug' => $slugRule,
            'content' => $forUpdate ? 'sometimes|required|string' : 'required|string',
            'status' => 'nullable|in:draft,published,archived',
            'type' => 'nullable|in:'.implode(',', [Post::TYPE_ARTICLE, Post::TYPE_GUIDE, Post::TYPE_COMPARISON]),
            'featured_image' => 'nullable|string',
            'featured_image_alt' => 'nullable|string|max:255',
            'featured_media_id' => 'nullable|exists:curator_media,id',
            'author' => 'nullable|string|max:255',
            'read_time' => 'nullable|integer|min:0',
            'published_at' => 'nullable|date',
            'comparison_intro' => 'nullable|string',
            'disclosure_shown' => 'nullable|boolean',
            'comparison_items' => 'nullable|array',
            'comparison_items.*.product_name' => 'required_with:comparison_items|string|max:255',
            'comparison_items.*.image_url' => 'nullable|string|max:2048',
            'comparison_items.*.retailer' => 'required_with:comparison_items|string|exists:affiliate_networks,slug',
            'comparison_items.*.highlight' => 'nullable|string|max:255',
            'comparison_items.*.in_stock' => 'nullable|boolean',
            'comparison_items.*.price_display' => 'nullable|string|max:64',
            'comparison_items.*.price_cents' => 'nullable|integer|min:0',
            'comparison_items.*.rating' => 'nullable|numeric|min:0|max:5',
            'comparison_items.*.affiliate_url' => 'required_with:comparison_items|url|max:2048',
            'comparison_items.*.pros' => 'nullable|array',
            'comparison_items.*.pros.*' => 'string|max:255',
            'comparison_items.*.cons' => 'nullable|array',
            'comparison_items.*.cons.*' => 'string|max:255',
            'comparison_items.*.in_house_match_url' => 'nullable|string|max:2048',
        ];
    }

    /**
     * Pull comparison-only fields out of the validated payload so they
     * aren't passed to Post::create()/update() (they aren't Post columns —
     * they're persisted separately via HasMetadata).
     */
    protected function extractComparisonData(array &$validated): array
    {
        $comparison = [
            'comparison_intro' => $validated['comparison_intro'] ?? null,
            'disclosure_shown' => $validated['disclosure_shown'] ?? true,
            'comparison_items' => $validated['comparison_items'] ?? [],
        ];

        unset($validated['comparison_intro'], $validated['disclosure_shown'], $validated['comparison_items']);

        return $comparison;
    }

    protected function syncComparisonMeta(Post $post, array $data): void
    {
        $post->setMeta('comparison_intro', $data['comparison_intro']);
        $post->setMeta('disclosure_shown', $data['disclosure_shown'] ? '1' : '0', 'bool');
        $post->setMeta('comparison_items', $data['comparison_items'], 'json');
    }
}
