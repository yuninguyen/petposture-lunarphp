<?php

namespace App\Filament\Resources;

use App\Filament\Resources\ReviewResource\Pages;
use App\Models\Review;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

class ReviewResource extends Resource
{
    protected static ?string $model = Review::class;

    protected static ?string $navigationIcon = 'heroicon-o-chat-bubble-bottom-center-text';

    /**
     * Reviews are moderated here, but storefront product pages are the canonical
     * ingest path for customer-submitted reviews.
     */

    public static function getNavigationGroup(): ?string
    {
        return __('Sales');
    }

    protected static ?int $navigationSort = 5;

    public static function getLabel(): string
    {
        return __('Review');
    }

    public static function getPluralLabel(): string
    {
        return __('Reviews');
    }

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Section::make(__('Review Information'))
                    ->description(__('Use this screen to moderate existing storefront reviews.'))
                    ->schema([
                        Forms\Components\Select::make('product_id')
                            ->label(__('Product'))
                            ->relationship('product', 'name')
                            ->required()
                            ->searchable()
                            ->helperText(__('Reviews remain linked to legacy authoring products while storefront products resolve through sync mappings.')),
                        Forms\Components\TextInput::make('customer_name')
                            ->label(__('Customer Name'))
                            ->required()
                            ->maxLength(255),
                        Forms\Components\Select::make('rating')
                            ->label(__('Rating'))
                            ->options([
                                1 => '1 ' . __('Star'),
                                2 => '2 ' . __('Star'),
                                3 => '3 ' . __('Star'),
                                4 => '4 ' . __('Star'),
                                5 => '5 ' . __('Star'),
                            ])
                            ->required(),
                        Forms\Components\Toggle::make('is_verified')
                            ->label(__('Verified Purchase'))
                            ->default(true),
                        Forms\Components\Textarea::make('comment')
                            ->label(__('Comment'))
                            ->required()
                            ->columnSpanFull(),
                    ])->columns(2),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('product.name')
                    ->label(__('Product'))
                    ->sortable()
                    ->searchable(),
                Tables\Columns\TextColumn::make('product.syncMapping.lunar_product_id')
                    ->label(__('Storefront Product'))
                    ->badge()
                    ->placeholder(__('Not synced')),
                Tables\Columns\TextColumn::make('customer_name')
                    ->label(__('Customer'))
                    ->searchable()
                    ->sortable(),
                Tables\Columns\TextColumn::make('rating')
                    ->label(__('Rating'))
                    ->sortable(),
                Tables\Columns\IconColumn::make('is_verified')
                    ->boolean()
                    ->label(__('Verified')),
                Tables\Columns\TextColumn::make('created_at')
                    ->label(__('Created At'))
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('product')
                    ->label(__('Product'))
                    ->relationship('product', 'name'),
            ])
            ->actions([
                Tables\Actions\EditAction::make(),
                Tables\Actions\DeleteAction::make(),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                ]),
            ]);
    }

    public static function getRelations(): array
    {
        return [
            //
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListReviews::route('/'),
            'edit' => Pages\EditReview::route('/{record}/edit'),
        ];
    }

    public static function canCreate(): bool
    {
        return false;
    }
}
