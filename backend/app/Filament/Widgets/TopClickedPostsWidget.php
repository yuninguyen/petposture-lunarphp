<?php

namespace App\Filament\Widgets;

use App\Models\AffiliateClick;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget;
use Illuminate\Support\Carbon;

class TopClickedPostsWidget extends TableWidget
{
    protected static bool $isLazy = false;

    protected static ?int $sort = 1;

    protected int|string|array $columnSpan = [
        'default' => 1,
        'md' => 2,
        'xl' => 2,
    ];

    public static function getHeading(): ?string
    {
        return __('Top Clicked Posts (30 days)');
    }

    public function table(Table $table): Table
    {
        return $table
            ->heading($this->getHeading())
            ->query(
                AffiliateClick::query()
                    ->selectRaw('max(id) as id, post_id, count(*) as total')
                    ->where('created_at', '>=', Carbon::now()->subDays(30))
                    ->groupBy('post_id')
                    ->with('post')
                    ->limit(10)
            )
            ->defaultSort('total', 'desc')
            ->paginated(false)
            ->columns([
                TextColumn::make('post.title')
                    ->label(__('Post'))
                    ->default(__('(deleted post)')),
                TextColumn::make('total')
                    ->label(__('Clicks'))
                    ->numeric()
                    ->alignEnd(),
            ]);
    }
}
