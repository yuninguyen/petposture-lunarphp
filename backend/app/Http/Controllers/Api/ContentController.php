<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\PostResource;
use App\Models\BlogCategory;
use App\Models\Page;
use App\Models\Post;
use App\Traits\HttpResponses;

class ContentController extends Controller
{
    use HttpResponses;

    public function posts()
    {
        $posts = Post::where('status', 'published')
            ->where('published_at', '<=', now())
            ->with(['blogCategory', 'metadata'])
            ->latest()
            ->paginate(12);

        return PostResource::collection($posts);
    }

    public function post($slug)
    {
        $post = Post::where('slug', $slug)
            ->where('status', 'published')
            ->with(['blogCategory', 'metadata'])
            ->firstOrFail();

        return new PostResource($post);
    }

    public function page($slug)
    {
        $page = Page::where('slug', $slug)
            ->where('is_active', true)
            ->firstOrFail();

        return response()->json([
            'data' => [
                'slug' => $page->slug,
                'title' => $page->title,
                'content' => $this->renderPlaceholders($page->content),
                'meta_title' => $page->meta_title,
                'meta_description' => $page->meta_description,
                'updated_at' => $page->updated_at,
            ],
        ]);
    }

    /**
     * Substitute {{business_phone}}/{{business_address}}/{{business_address_inline}}
     * tokens in page content with the live Settings values, so legal-page copy
     * stays in sync with admin edits instead of needing the phone/address
     * re-typed into every page's rich text separately.
     */
    private function renderPlaceholders(?string $content): ?string
    {
        if ($content === null) {
            return null;
        }

        $phone = setting('business_phone') ?: '+1 (916) 668-0065';
        $address = setting('business_address') ?: '2017 I St A, Sacramento, CA 95811, United States';

        return str_replace(
            ['{{business_phone}}', '{{business_address}}', '{{business_address_inline}}'],
            [$phone, $this->formatAddressMultiline($address), $address],
            $content
        );
    }

    /**
     * "Street, City, State Zip, Country" -> "Street<br>City, State Zip<br>Country"
     * (3 display lines, not one per comma) — matches the standard mailing-address
     * layout: street / city+state+zip / country.
     */
    private function formatAddressMultiline(string $address): string
    {
        $parts = array_map('trim', explode(',', $address));

        if (count($parts) === 4) {
            [$street, $city, $stateZip, $country] = $parts;

            return "{$street}<br>{$city}, {$stateZip}<br>{$country}";
        }

        return str_replace(', ', '<br>', $address);
    }

    public function categories()
    {
        return response()->json([
            'data' => BlogCategory::all()->map(fn ($c) => [
                'id' => $c->id,
                'name' => $c->name,
                'slug' => $c->slug,
            ])->values(),
        ]);
    }
}
