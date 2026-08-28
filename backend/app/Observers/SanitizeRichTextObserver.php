<?php

namespace App\Observers;

use App\Security\RichTextSanitizer;
use Illuminate\Database\Eloquent\Model;

class SanitizeRichTextObserver
{
    public function __construct(private readonly RichTextSanitizer $sanitizer) {}

    public function saving(Model $model): void
    {
        if ($model->isDirty('content')) {
            $model->setAttribute('content', $this->sanitizer->sanitize($model->getAttribute('content')));
        }
    }
}
