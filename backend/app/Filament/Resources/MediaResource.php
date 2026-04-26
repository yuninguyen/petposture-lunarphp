<?php

namespace App\Filament\Resources;

use App\Filament\Resources\MediaResource\Pages\ListMedia;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

class MediaResource extends Resource
{
    protected static ?string $model = Media::class;

    protected static ?string $navigationIcon = 'heroicon-o-photo';

    protected static ?int $navigationSort = 4;

    protected static ?string $navigationLabel = 'Media Management';

    protected static ?string $modelLabel = 'Media';

    protected static ?string $pluralModelLabel = 'Media Library';

    public static function getNavigationGroup(): ?string
    {
        return __('System');
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('created_at', 'desc')
            ->columns([
                Tables\Columns\ImageColumn::make('original_url')
                    ->label('Preview')
                    ->square(),
                Tables\Columns\TextColumn::make('file_name')
                    ->label('File')
                    ->searchable()
                    ->sortable(),
                Tables\Columns\TextColumn::make('collection_name')
                    ->label('Collection')
                    ->badge()
                    ->sortable(),
                Tables\Columns\TextColumn::make('model_type')
                    ->label('Attached To')
                    ->formatStateUsing(fn(string $state): string => class_basename($state))
                    ->sortable(),
                Tables\Columns\TextColumn::make('model_id')
                    ->label('Record ID')
                    ->sortable(),
                Tables\Columns\TextColumn::make('human_readable_size')
                    ->label('Size'),
                Tables\Columns\TextColumn::make('created_at')
                    ->dateTime('d/m/Y H:i')
                    ->sortable(),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('collection_name')
                    ->options([
                        'product-images' => 'Product Images',
                        'variant-images' => 'Variant Images',
                    ]),
            ])
            ->actions([
                Tables\Actions\DeleteAction::make(),
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
            'index' => ListMedia::route('/'),
        ];
    }
}
