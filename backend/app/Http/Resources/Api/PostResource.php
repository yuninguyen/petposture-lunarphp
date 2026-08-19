<?php

namespace App\Http\Resources\Api;

use App\Models\AffiliateNetwork;
use App\Models\Post;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PostResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $blogCategory = $this->blogCategory;
        $featuredImage = $this->resolveAssetUrl($this->featured_image);

        return [
            'id' => (string) $this->id,
            'title' => $this->title,
            'slug' => $this->slug,
            'content' => $this->content,
            'type' => $this->type,
            'featured_image' => $featuredImage,
            'featured_image_alt' => $this->featured_image_alt,
            'author' => $this->author,
            'read_time' => $this->read_time,
            'status' => $this->status,
            'created_at' => optional($this->created_at)?->toISOString(),
            'published_at' => optional($this->published_at)?->toISOString(),
            'category' => [
                'name' => $blogCategory?->name,
                'slug' => $blogCategory?->slug ?? (string) $blogCategory?->id,
            ],
            'blog_category' => $blogCategory ? [
                'id' => (string) $blogCategory->id,
                'name' => $blogCategory->name,
                'slug' => $blogCategory->slug,
            ] : null,
            'comparison' => $this->type === Post::TYPE_COMPARISON ? $this->resolveComparison() : null,
            'seo' => $this->resolveSeo(),
            'tags' => $this->tags->map(fn ($tag) => [
                'name' => $tag->name,
                'slug' => $tag->slug,
            ])->values(),
        ];
    }

    protected function resolveSeo(): ?array
    {
        $seo = $this->seo;

        if (! $seo) {
            return null;
        }

        return array_filter([
            'title' => $seo->title,
            'keyphrase' => $seo->keyphrase,
            'description' => $seo->description,
            'og_title' => $seo->og_title,
            'og_description' => $seo->og_description,
            'og_image' => $this->resolveAssetUrl($seo->og_image),
        ], static fn ($value) => $value !== null);
    }

    protected function resolveComparison(): array
    {
        $meta = $this->getAllMeta();
        $rawItems = collect($meta->get('comparison_items', []));

        $networks = AffiliateNetwork::whereIn('slug', $rawItems->pluck('retailer')->filter()->unique())
            ->get()
            ->keyBy('slug');

        $items = $rawItems
            ->values()
            ->map(function (array $item, int $index) use ($networks) {
                $network = $networks->get($item['retailer'] ?? null);

                return [
                    ...$item,
                    'image_url' => $this->resolveAssetUrl($item['image_url'] ?? null),
                    'retailer_label' => $network?->name ?? $item['retailer'] ?? null,
                    'retailer_logo' => $network ? $this->resolveAssetUrl($network->logo) : null,
                    'redirect_url' => url("/go/{$this->id}/{$index}"),
                    // Older items were seeded with string numerics in metadata JSON;
                    // the frontend does a strict `typeof === 'number'` check on rating.
                    'rating' => isset($item['rating']) && $item['rating'] !== '' ? (float) $item['rating'] : null,
                    'price_cents' => isset($item['price_cents']) ? (int) $item['price_cents'] : null,
                ];
            })
            ->values()
            ->all();

        return [
            'intro' => $meta->get('comparison_intro'),
            'disclosure_shown' => $meta->get('disclosure_shown', true),
            'items' => $items,
        ];
    }

    protected function resolveAssetUrl(mixed $path): ?string
    {
        // Filament's FileUpload stores `[]` for an empty single-file field, and a
        // populated one as `[<uuid> => 'path/to/file.webp']` -- keyed by a random
        // UUID, not index 0 -- so grab the first value regardless of its key.
        if (is_array($path)) {
            $path = array_values($path)[0] ?? null;
        }

        if (! $path) {
            return null;
        }

        if (filter_var($path, FILTER_VALIDATE_URL)) {
            return $path;
        }

        return asset('storage/'.ltrim($path, '/'));
    }
}
