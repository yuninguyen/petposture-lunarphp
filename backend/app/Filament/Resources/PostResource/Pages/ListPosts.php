<?php

namespace App\Filament\Resources\PostResource\Pages;

use App\Filament\Resources\PostResource;
use App\Models\Post;
use Filament\Actions;
use Filament\Resources\Components\Tab;
use Filament\Resources\Pages\ListRecords;
use Illuminate\Database\Eloquent\Builder;

class ListPosts extends ListRecords
{
    protected static string $resource = PostResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make(),
        ];
    }

    public function getTabs(): array
    {
        return [
            'all' => Tab::make(__('All')),
            Post::TYPE_ARTICLE => Tab::make(__('Article'))
                ->modifyQueryUsing(fn (Builder $query) => $query->where('type', Post::TYPE_ARTICLE))
                ->badge(Post::where('type', Post::TYPE_ARTICLE)->count()),
            Post::TYPE_GUIDE => Tab::make(__('Guide'))
                ->modifyQueryUsing(fn (Builder $query) => $query->where('type', Post::TYPE_GUIDE))
                ->badge(Post::where('type', Post::TYPE_GUIDE)->count()),
            Post::TYPE_COMPARISON => Tab::make(__('Comparison'))
                ->modifyQueryUsing(fn (Builder $query) => $query->where('type', Post::TYPE_COMPARISON))
                ->badge(Post::where('type', Post::TYPE_COMPARISON)->count()),
        ];
    }
}
