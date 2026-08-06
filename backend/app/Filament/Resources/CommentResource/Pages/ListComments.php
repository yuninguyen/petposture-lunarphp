<?php

namespace App\Filament\Resources\CommentResource\Pages;

use App\Filament\Resources\CommentResource;
use App\Models\Comment;
use Filament\Actions;
use Filament\Resources\Components\Tab;
use Filament\Resources\Pages\ListRecords;
use Illuminate\Database\Eloquent\Builder;

class ListComments extends ListRecords
{
    protected static string $resource = CommentResource::class;

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
            'pending' => Tab::make(__('Pending'))
                ->modifyQueryUsing(fn (Builder $query) => $query->where('status', 'pending'))
                ->badge(Comment::where('status', 'pending')->count())
                ->badgeColor('warning'),
            'approved' => Tab::make(__('Approved'))
                ->modifyQueryUsing(fn (Builder $query) => $query->where('status', 'approved'))
                ->badge(Comment::where('status', 'approved')->count())
                ->badgeColor('success'),
            'rejected' => Tab::make(__('Rejected'))
                ->modifyQueryUsing(fn (Builder $query) => $query->where('status', 'rejected'))
                ->badge(Comment::where('status', 'rejected')->count())
                ->badgeColor('danger'),
        ];
    }
}
