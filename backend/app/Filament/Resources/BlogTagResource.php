<?php

namespace App\Filament\Resources;

use App\Filament\Resources\BlogTagResource\Pages;
use App\Models\BlogTag;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Forms\Set;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class BlogTagResource extends Resource
{
    protected static ?string $model = BlogTag::class;

    protected static ?string $navigationIcon = 'heroicon-o-tag';

    public static function getNavigationGroup(): ?string
    {
        return __('Content Management');
    }

    public static function getLabel(): string
    {
        return __('Tag');
    }

    public static function getPluralLabel(): string
    {
        return __('Tags');
    }

    protected static ?int $navigationSort = 4;

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\TextInput::make('name')
                    ->label(__('Name'))
                    ->required()
                    ->live(onBlur: true)
                    ->afterStateUpdated(fn (string $operation, $state, Set $set) => $operation === 'create' ? $set('slug', Str::slug($state)) : null),
                Forms\Components\TextInput::make('slug')
                    ->label(__('Slug'))
                    ->required()
                    ->unique(ignoreRecord: true),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('posts_count')
            ->columns([
                Tables\Columns\TextColumn::make('name')
                    ->label(__('Tag'))
                    ->searchable()
                    ->sortable(),
                Tables\Columns\TextColumn::make('slug')
                    ->label(__('Slug')),
                Tables\Columns\TextColumn::make('posts_count')
                    ->label(__('Total Posts'))
                    ->counts('posts')
                    ->sortable(),
            ])
            ->filters([
                Tables\Filters\Filter::make('unused')
                    ->label(__('Unused only (0 posts)'))
                    ->query(fn ($query) => $query->doesntHave('posts')),
            ])
            ->actions([
                Tables\Actions\ActionGroup::make([
                    Tables\Actions\EditAction::make(),
                    Tables\Actions\Action::make('merge')
                        ->label(__('Merge'))
                        ->icon('heroicon-o-arrow-path-rounded-square')
                        ->color('gray')
                        ->form(fn (BlogTag $record) => [
                            Forms\Components\Select::make('target_tag_id')
                                ->label(__('Merge into'))
                                ->helperText(__('All posts using ":name" will be moved to the tag you pick here, then ":name" will be deleted.', ['name' => $record->name]))
                                ->options(fn () => BlogTag::where('id', '!=', $record->id)->orderBy('name')->pluck('name', 'id'))
                                ->required()
                                ->searchable(),
                        ])
                        ->action(function (BlogTag $record, array $data) {
                            $target = BlogTag::findOrFail($data['target_tag_id']);

                            DB::transaction(function () use ($record, $target) {
                                $postIds = $record->posts()->pluck('posts.id');
                                $target->posts()->syncWithoutDetaching($postIds);
                                $record->delete();
                            });

                            Notification::make()
                                ->title(__('Merged ":from" into ":to"', ['from' => $record->name, 'to' => $target->name]))
                                ->success()
                                ->send();
                        }),
                    Tables\Actions\DeleteAction::make(),
                ]),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                ]),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListBlogTags::route('/'),
            'create' => Pages\CreateBlogTag::route('/create'),
            'edit' => Pages\EditBlogTag::route('/{record}/edit'),
        ];
    }
}
