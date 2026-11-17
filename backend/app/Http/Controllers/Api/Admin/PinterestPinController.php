<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\PinterestPinRequest;
use App\Http\Resources\Admin\PinterestPinResource;
use App\Models\CuratorMedia;
use App\Models\PinterestPin;
use App\Models\Post;
use App\Services\Pinterest\PinterestImage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Pinterest pins prepared in the admin, posted by hand or by the posting job. Nothing here talks to Pinterest:
 * the job (PinterestPublisher) does, and a person can still mark a pin posted.
 */
class PinterestPinController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $validated = $request->validate([
            'status' => ['nullable', Rule::in(PinterestPin::ALL_STATUSES)],
            'post_id' => ['nullable', 'integer'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $pins = PinterestPin::query()
            ->with(['post:id,title,slug', 'media'])
            ->when($validated['status'] ?? null, fn ($query, string $status) => $query->where('status', $status))
            ->when($validated['post_id'] ?? null, fn ($query, int $postId) => $query->where('post_id', $postId))
            ->latest()
            ->latest('id')
            ->paginate($validated['per_page'] ?? 20)
            ->withQueryString();

        return PinterestPinResource::collection($pins);
    }

    /** What the form offers: the boards used so far (to suggest) and the published posts (to link a pin to). */
    public function options(): JsonResponse
    {
        $boards = PinterestPin::query()
            ->whereNotNull('board')
            ->where('board', '!=', '')
            ->distinct()
            ->orderBy('board')
            ->pluck('board')
            ->values();

        $posts = Post::query()
            ->where('status', 'published')
            ->latest('published_at')
            ->latest('id')
            ->limit(200)
            ->get(['id', 'title', 'slug'])
            ->map(fn (Post $post) => [
                'id' => $post->id,
                'title' => $post->title,
                'slug' => $post->slug,
                'url' => PinterestPin::urlForPost($post),
            ])
            ->values();

        return response()->json(['data' => ['boards' => $boards, 'posts' => $posts]]);
    }

    public function store(PinterestPinRequest $request): JsonResponse
    {
        $data = $request->validated();

        $pin = new PinterestPin([
            'post_id' => $data['post_id'] ?? null,
            'title' => $data['title'],
            'description' => $data['description'],
            'board' => $data['board'] ?? null,
            'pinterest_board_id' => $data['pinterest_board_id'] ?? null,
            'scheduled_date' => $data['scheduled_date'] ?? null,
        ]);
        $pin->image = CuratorMedia::query()->findOrFail($data['media_id'])->path;
        $pin->destination_url = $this->destinationUrl($data['destination_url'] ?? null, $pin->post_id);
        $pin->setStatus($data['status'] ?? PinterestPin::STATUS_READY)->save();

        return (new PinterestPinResource($pin->load(['post:id,title,slug', 'media'])))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    public function show(PinterestPin $pinterestPin): PinterestPinResource
    {
        return new PinterestPinResource($pinterestPin->load(['post:id,title,slug', 'media']));
    }

    public function update(PinterestPinRequest $request, PinterestPin $pinterestPin): PinterestPinResource
    {
        $data = $request->validated();

        $pinterestPin->fill(array_intersect_key($data, array_flip(['post_id', 'title', 'description', 'board', 'pinterest_board_id', 'scheduled_date'])));

        if (array_key_exists('media_id', $data)) {
            $pinterestPin->image = CuratorMedia::query()->findOrFail($data['media_id'])->path;
        }

        if (array_key_exists('destination_url', $data)) {
            $pinterestPin->destination_url = $this->destinationUrl($data['destination_url'], $pinterestPin->post_id);
        }

        if (array_key_exists('status', $data)) {
            $pinterestPin->setStatus($data['status']);
        }

        $pinterestPin->save();

        return new PinterestPinResource($pinterestPin->load(['post:id,title,slug', 'media']));
    }

    /** Only the pin goes: the image stays in the media library, which decides when a file may be deleted. */
    public function destroy(PinterestPin $pinterestPin): Response
    {
        $pinterestPin->delete();

        return response()->noContent();
    }

    /** The image as a file named after the pin, for uploading to Pinterest by hand. */
    public function download(PinterestPin $pinterestPin): StreamedResponse
    {
        $disk = Storage::disk(config('curator.disk'));

        abort_unless($disk->exists($pinterestPin->image), Response::HTTP_NOT_FOUND, 'The image file of this pin is missing.');

        $name = Str::slug($pinterestPin->title) ?: 'pinterest-pin';
        $extension = strtolower(pathinfo($pinterestPin->image, PATHINFO_EXTENSION));

        // Pinterest's own upload takes JPG and PNG only, and the library stores WebP: hand over a JPG for those.
        try {
            [$bytes, $mime, $pinterestExtension] = PinterestImage::forPinterest($disk->get($pinterestPin->image), $extension);

            return response()->streamDownload(function () use ($bytes): void {
                echo $bytes;
            }, "{$name}.{$pinterestExtension}", ['Content-Type' => $mime]);
        } catch (RuntimeException) {
            // Could not convert: give the file as it is rather than nothing.
            return $disk->download($pinterestPin->image, $extension !== '' ? "{$name}.{$extension}" : $name);
        }
    }

    /**
     * The link a pin points to: what was typed, else the public URL of the chosen post. A pin with neither has
     * nowhere to send people.
     */
    private function destinationUrl(?string $typed, ?int $postId): string
    {
        if (filled($typed)) {
            return $typed;
        }

        $post = $postId ? Post::query()->find($postId) : null;

        if (! $post) {
            throw ValidationException::withMessages(['destination_url' => 'Enter the link this pin goes to, or choose a post.']);
        }

        return PinterestPin::urlForPost($post);
    }
}
