<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\PostResource;
use App\Models\BlogCategory;
use App\Models\Post;
use App\Support\PickKind;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Lunar\Models\Product;

class PostController extends Controller
{
    private function authorizeAdmin(string $ability = 'view_any_post'): void
    {
        Gate::authorize($ability);
    }

    public function index(Request $request)
    {
        $this->authorizeAdmin();

        $query = Post::with(['blogCategory', 'metadata', 'tags', 'seo', 'featuredMedia', 'breeds', 'solutions'])->latest();

        if ($request->has('category')) {
            $query->whereHas('blogCategory', function ($q) use ($request) {
                $q->where('slug', $request->category);
            });
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('type')) {
            $query->where('type', $request->type);
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

    public function storeCategory(Request $request): JsonResponse
    {
        $this->authorizeAdmin('create_post');

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255|unique:blog_categories,slug',
        ]);

        $category = BlogCategory::create([
            'name' => $validated['name'],
            'slug' => $validated['slug'] ?? Str::slug($validated['name']).'-'.rand(1000, 9999),
        ]);

        return response()->json($category, 201);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeAdmin('create_post');

        $validated = $this->applySchedule($request->validate($this->validationRules(forUpdate: false)), null);
        if (in_array($validated['status'] ?? 'draft', ['published', 'scheduled'], true)) {
            $this->authorizeAdmin('publish_post');
        }
        $validated['type'] = $validated['type'] ?? Post::TYPE_ARTICLE;
        $validated['status'] = $validated['status'] ?? 'draft';
        $comparison = $this->extractComparisonData($validated);
        $taxonomy = $this->extractTaxonomyData($validated);
        $seoData = $this->extractSeoData($validated);

        // read_time is always server-computed from content (legacy Filament
        // behavior) — never user-editable, never taken from the client.
        $validated['read_time'] = Post::estimateReadTime($validated['content']);

        // Slug stays optional from the client — generate it when absent (as the
        // original store() did) so older API clients and the admin form keep
        // working without a slug field.
        $validated['slug'] = $validated['slug'] ?? Str::slug($validated['title']).'-'.rand(1000, 9999);

        if ($validated['status'] === 'published' && empty($validated['published_at'])) {
            $validated['published_at'] = now();
        }

        $post = Post::create($validated);

        if ($post->type === Post::TYPE_COMPARISON) {
            $this->syncComparisonMeta($post, $comparison);
        }

        $this->syncTaxonomy($post, $taxonomy);

        if ($seoData !== null) {
            $post->seo()->updateOrCreate([], $seoData);
        }

        activity()
            ->causedBy($request->user())
            ->performedOn($post)
            ->event('created')
            ->withProperties([
                'after' => [
                    'title' => $post->title,
                    'slug' => $post->slug,
                    'status' => $post->status,
                ],
            ])
            ->log('created');

        return (new PostResource($post->fresh()))->response()->setStatusCode(201);
    }

    public function show(Post $post)
    {
        $this->authorizeAdmin();

        return new PostResource($post->load('blogCategory', 'products'));
    }

    /**
     * The Picks a post can mention: published, with a variant (so the storefront can show them), and a retailer
     * link. Behind the post permission, so a writer who cannot open the product list can still choose from here.
     */
    public function pickOptions(): JsonResponse
    {
        $this->authorizeAdmin();

        $query = Product::query()->where('status', 'published')->whereHas('variants')->with(['brand', 'thumbnail']);
        $products = PickKind::constrain($query, PickKind::PICK)->get();

        return response()->json(['data' => $products
            ->map(fn (Product $product): array => [
                'id' => $product->id,
                'name' => (string) $product->translateAttribute('name'),
                'brand' => $product->brand?->name,
                'reference_price' => $this->referencePrice($product),
                'thumbnail' => $product->thumbnail?->getUrl('small') ?: null,
            ])
            ->sortBy(fn (array $option) => strtolower(($option['brand'] ?? '').' '.$option['name']))
            ->values(),
        ]);
    }

    private function referencePrice(Product $product): ?float
    {
        $raw = str_replace(['$', ','], '', trim((string) $product->translateAttribute('reference_price')));

        return is_numeric($raw) && (float) $raw >= 0 ? round((float) $raw, 2) : null;
    }

    public function update(Request $request, Post $post)
    {
        $this->authorizeAdmin('update_post');

        // A live post is edited, or taken back to draft, only by someone who may publish:
        // update_post alone is not tied to authorship, so without this a writer could change
        // an article under its readers.
        if (in_array($post->status, ['published', 'scheduled'], true)) {
            $this->authorizeAdmin('publish_post');
        }

        $validated = $this->applySchedule($request->validate($this->validationRules(forUpdate: true)), $post);
        if (in_array($validated['status'] ?? null, ['published', 'scheduled'], true) && ! in_array($post->status, ['published', 'scheduled'], true)) {
            $this->authorizeAdmin('publish_post');
        }
        $comparison = $this->extractComparisonData($validated);
        $taxonomy = $this->extractTaxonomyData($validated);
        $seoData = $this->extractSeoData($validated);

        if (isset($validated['content'])) {
            $validated['read_time'] = Post::estimateReadTime($validated['content']);
        }

        if (isset($validated['status']) && $validated['status'] === 'published' && ! $post->published_at) {
            $validated['published_at'] = now();
        }

        $before = [
            'title' => $post->title,
            'slug' => $post->slug,
            'status' => $post->status,
        ];

        $post->update($validated);

        if ($post->type === Post::TYPE_COMPARISON) {
            $this->syncComparisonMeta($post, $comparison);
        }

        $this->syncTaxonomy($post, $taxonomy);

        if ($seoData !== null) {
            $post->seo()->updateOrCreate([], $seoData);
        }

        $fresh = $post->fresh();
        $after = [
            'title' => $fresh->title,
            'slug' => $fresh->slug,
            'status' => $fresh->status,
        ];

        $diffBefore = [];
        $diffAfter = [];
        foreach ($before as $key => $val) {
            if ($val !== $after[$key]) {
                $diffBefore[$key] = $val;
                $diffAfter[$key] = $after[$key];
            }
        }

        if (! empty($diffBefore)) {
            activity()
                ->causedBy($request->user())
                ->performedOn($post)
                ->event('updated')
                ->withProperties([
                    'before' => $diffBefore,
                    'after' => $diffAfter,
                ])
                ->log('updated');
        }

        return new PostResource($fresh);
    }

    public function duplicate(Post $post): JsonResponse
    {
        $this->authorizeAdmin('create_post');

        $replica = $post->replicate();
        $replica->title = $post->title.' '.__('(Copy)');
        $replica->slug = Str::slug($replica->title).'-'.Str::random(6);
        $replica->status = 'draft';
        $replica->published_at = null;
        $replica->save();

        // Copy metadata preserving each row's stored type (json/bool/string),
        // matching how setMeta() originally wrote them.
        foreach ($post->metadata as $meta) {
            $replica->setMeta($meta->key, $meta->cast_value, $meta->type);
        }

        $replica->breeds()->sync($post->breeds->pluck('id'));
        $replica->solutions()->sync($post->solutions->pluck('id'));
        $replica->tags()->sync($post->tags->pluck('id'));
        $replica->products()->sync($post->products()->pluck('lunar_products.id'));

        if ($post->seo) {
            $replica->seo()->create($post->seo->only([
                'title', 'keyphrase', 'description', 'og_title', 'og_description', 'og_image',
            ]));
        }

        return (new PostResource($replica->fresh()))->response()->setStatusCode(201);
    }

    public function bulkDestroy(Request $request): JsonResponse
    {
        $this->authorizeAdmin('delete_any_post');

        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer|exists:posts,id',
        ]);

        Post::whereIn('id', $validated['ids'])->delete();

        return response()->json(null, 204);
    }

    public function destroy(Request $request, Post $post)
    {
        $this->authorizeAdmin('delete_post');

        $before = [
            'title' => $post->title,
            'slug' => $post->slug,
            'status' => $post->status,
        ];

        $post->delete();

        activity()
            ->causedBy($request->user())
            ->performedOn($post)
            ->event('deleted')
            ->withProperties([
                'before' => $before,
            ])
            ->log('deleted');

        return response()->json(null, 204);
    }

    public function previewUrl(Post $post): JsonResponse
    {
        $this->authorizeAdmin();

        // Signed on the path alone (absolute: false): the storefront renders on the server and
        // calls this API over an internal address, so a signature that also covered the public
        // host and scheme would never match and every draft preview would 404.
        $signedUrl = URL::temporarySignedRoute('posts.show', now()->addDay(), [
            'slug' => $post->slug,
        ], absolute: false);
        $url = rtrim(config('app.frontend_url'), '/')
            ."/blog/{$post->slug}?"
            .parse_url($signedUrl, PHP_URL_QUERY);

        return response()->json(['url' => $url]);
    }

    /**
     * The scheduling rules for a save. The publish time is a moment in time (the admin sends it in UTC).
     * - "published" with a time still ahead becomes "scheduled": the post is not live until then, so it must not say it is.
     *   A post that is already live cannot be moved into the future this way; it would silently go offline.
     * - "scheduled" needs a time ahead; an unchanged time that has just passed is left for the scheduler to publish.
     * - Cancelling a schedule (scheduled to draft) clears the time, so a stale date cannot publish it later.
     */
    private function applySchedule(array $validated, ?Post $post): array
    {
        $status = $validated['status'] ?? $post?->status;
        $publishedAt = array_key_exists('published_at', $validated) ? $validated['published_at'] : $post?->published_at;
        $when = $publishedAt ? Carbon::parse($publishedAt) : null;

        // Always stored as the UTC moment: a time sent with an offset (10:47-05:00) must not be saved as 10:47.
        if (array_key_exists('published_at', $validated) && $when) {
            $validated['published_at'] = $when->copy()->utc()->toDateTimeString();
        }

        if ($status === 'published' && $when?->isFuture()) {
            $isLive = $post && $post->status === 'published' && $post->published_at && $post->published_at->isPast();
            if ($isLive) {
                throw ValidationException::withMessages(['published_at' => 'This post is already live. Set it to Draft first to schedule it for later.']);
            }

            $status = 'scheduled';
            $validated['status'] = 'scheduled';
        }

        if ($status === 'scheduled') {
            $unchanged = $post && $post->status === 'scheduled' && $post->published_at && $when && $when->equalTo($post->published_at);

            if (! $when || (! $unchanged && ! $when->isFuture())) {
                throw ValidationException::withMessages(['published_at' => 'A scheduled post needs a publish time in the future.']);
            }
        }

        if ($post && $post->status === 'scheduled' && ($validated['status'] ?? null) === 'draft') {
            $validated['published_at'] = null;
        }

        return $validated;
    }

    protected function validationRules(bool $forUpdate): array
    {
        $slugRule = $forUpdate
            ? 'sometimes|required|string|max:255|unique:posts,slug,'.(request()->route('post')?->id ?? 0)
            : 'sometimes|required|string|max:255|unique:posts,slug';

        return [
            'blog_category_id' => $forUpdate ? 'sometimes|required|exists:blog_categories,id' : 'required|exists:blog_categories,id',
            'title' => $forUpdate ? 'sometimes|required|string|max:255' : 'required|string|max:255',
            'slug' => $slugRule,
            'content' => $forUpdate ? 'sometimes|required|string' : 'required|string',
            'status' => 'nullable|in:draft,published,scheduled,archived',
            'type' => 'nullable|in:'.implode(',', [Post::TYPE_ARTICLE, Post::TYPE_GUIDE, Post::TYPE_COMPARISON]),
            'featured_image' => 'nullable|string',
            'featured_image_alt' => 'nullable|string|max:255',
            'featured_media_id' => 'nullable|exists:curator_media,id',
            'author' => 'nullable|string|max:255',
            'read_time' => 'nullable|string|max:64',
            'published_at' => 'nullable|date',
            'breeds' => 'nullable|array',
            'breeds.*' => 'integer|exists:breeds,id',
            'solutions' => 'nullable|array',
            'solutions.*' => 'integer|exists:solutions,id',
            'tags' => 'nullable|array',
            'tags.*' => 'integer|exists:blog_tags,id',
            'product_ids' => 'nullable|array|max:20',
            'product_ids.*' => ['integer', 'distinct', function (string $attribute, mixed $value, \Closure $fail): void {
                $product = Product::find($value);

                if (! $product || PickKind::of($product) !== PickKind::PICK) {
                    $fail(__('Only Picks can be linked to a post.'));
                }
            }],
            'seo' => 'nullable|array',
            'seo.title' => 'nullable|string|max:60',
            'seo.keyphrase' => 'nullable|string|max:255',
            'seo.description' => 'nullable|string|max:160',
            'seo.og_title' => 'nullable|string|max:255',
            'seo.og_description' => 'nullable|string|max:500',
            'seo.og_image' => 'nullable|string|max:2048',
            'comparison_intro' => 'nullable|string',
            'disclosure_shown' => 'nullable|boolean',
            'comparison_items' => 'nullable|array',
            'comparison_items.*.product_name' => 'required_with:comparison_items|string|max:255',
            'comparison_items.*.image_url' => 'nullable|string|max:2048',
            'comparison_items.*.image_alt' => 'nullable|string|max:255',
            'comparison_items.*.retailer' => 'required_with:comparison_items|string|exists:affiliate_networks,slug',
            'comparison_items.*.highlight' => 'nullable|string|max:40',
            'comparison_items.*.in_stock' => 'nullable|boolean',
            'comparison_items.*.price_display' => 'nullable|string|max:64',
            'comparison_items.*.price_cents' => 'nullable|integer|min:0',
            'comparison_items.*.rating' => 'nullable|numeric|min:0|max:5',
            'comparison_items.*.metadata' => 'nullable|array',
            'comparison_items.*.metadata.source_url' => 'required_with:comparison_items.*.price_display,comparison_items.*.price_cents,comparison_items.*.rating|url|max:2048',
            'comparison_items.*.metadata.checked_at' => 'required_with:comparison_items.*.price_display,comparison_items.*.price_cents,comparison_items.*.rating|date_format:Y-m-d\\TH:i:s\\Z',
            'comparison_items.*.affiliate_url' => 'nullable|url|max:2048',
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
            'disclosure_shown' => ($validated['disclosure_shown'] ?? true)
                || collect($validated['comparison_items'] ?? [])->contains(fn (array $item): bool => filled($item['affiliate_url'] ?? null)),
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

    /**
     * Pull the taxonomy-only fields out of the validated payload so they
     * aren't passed to Post::create()/update() (they aren't Post columns —
     * they're persisted via the belongsToMany pivot tables).
     */
    protected function extractTaxonomyData(array &$validated): array
    {
        $taxonomy = [
            'breeds' => $validated['breeds'] ?? [],
            'solutions' => $validated['solutions'] ?? [],
            'tags' => $validated['tags'] ?? [],
            // Unlike the three above, an absent product_ids means "leave the links alone", so a partial update
            // can never wipe them; only a list that was actually sent (even an empty one) is written.
            'product_ids' => isset($validated['product_ids']) ? array_values($validated['product_ids']) : null,
        ];

        unset($validated['breeds'], $validated['solutions'], $validated['tags'], $validated['product_ids']);

        return $taxonomy;
    }

    protected function syncTaxonomy(Post $post, array $taxonomy): void
    {
        $post->breeds()->sync($taxonomy['breeds']);
        $post->solutions()->sync($taxonomy['solutions']);
        $post->tags()->sync($taxonomy['tags']);

        if ($taxonomy['product_ids'] !== null) {
            $post->products()->sync($taxonomy['product_ids']);
        }
    }

    /**
     * Pull the seo sub-object out of the validated payload (it isn't a Post
     * column — it's persisted via the polymorphic SeoMetadata row). Returns
     * null when the client didn't send the field at all, so an absent `seo`
     * never clobbers an existing row.
     */
    protected function extractSeoData(array &$validated): ?array
    {
        $seo = $validated['seo'] ?? null;

        unset($validated['seo']);

        return is_array($seo) ? $seo : null;
    }
}
