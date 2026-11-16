<?php

namespace App\Http\Requests\Admin;

use App\Models\CuratorMedia;
use App\Models\PinterestPin;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Create and update of a Pinterest pin. On create the image, title and description are required; on update only
 * what is sent is validated, so the admin can change one field or just the status.
 */
class PinterestPinRequest extends FormRequest
{
    /** Pinterest takes these; the media library also accepts gif, svg and avif, which a pin must not use. */
    public const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

    public function authorize(): bool
    {
        // Access is decided by the admin.permission middleware on the route.
        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        $required = $this->isMethod('post') ? 'required' : 'sometimes';

        return [
            'post_id' => ['nullable', 'integer', 'exists:posts,id'],
            'media_id' => [$required, 'integer', 'exists:curator_media,id'],
            'title' => [$required, 'string', 'max:100'],
            'description' => [$required, 'string', 'max:500'],
            // A chosen post fills this in when it is left blank, so only a pin without a post must have one.
            'destination_url' => $this->isMethod('post')
                ? ['required_without:post_id', 'nullable', 'url', 'max:2048']
                : ['sometimes', 'nullable', 'url', 'max:2048'],
            'board' => ['nullable', 'string', 'max:255'],
            // Chosen from the connected Pinterest account's boards; needed for the pin to be posted automatically.
            'pinterest_board_id' => ['nullable', 'string', 'max:64'],
            'status' => ['sometimes', Rule::in(PinterestPin::STATUSES)],
            'scheduled_date' => ['nullable', 'date_format:Y-m-d'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->has('media_id') || ! $this->filled('media_id')) {
                return;
            }

            $extension = strtolower((string) CuratorMedia::query()->whereKey($this->integer('media_id'))->value('ext'));

            if (! in_array($extension, self::IMAGE_EXTENSIONS, true)) {
                $validator->errors()->add('media_id', 'The image must be a JPG, PNG or WebP file.');
            }
        });
    }
}
