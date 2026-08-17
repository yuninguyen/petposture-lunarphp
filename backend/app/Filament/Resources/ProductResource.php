<?php

namespace App\Filament\Resources;

use App\Filament\Resources\ProductResource\Pages\ListProducts;
use Filament\Forms\Components\Component;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Support\Enums\IconPosition;
use Filament\Tables;
use Filament\Tables\Columns\SpatieMediaLibraryImageColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;
use Lunar\Admin\Filament\Resources\ProductResource as BaseProductResource;
use Lunar\Admin\Support\Tables\Columns\TranslatedTextColumn;

class ProductResource extends BaseProductResource
{
    // Tags aren't shown anywhere on the storefront (only Lunar's internal
    // admin search reads them) and add nothing meaningful for a small
    // catalog — hidden here rather than in Lunar's form() to keep this
    // override tiny and easy to revert.
    protected static function getTagsFormComponent(): Component
    {
        return parent::getTagsFormComponent()->hidden();
    }

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()
            ->with(['collections', 'brand', 'variants.prices']);
    }

    public static function getDefaultTable(Table $table): Table
    {
        return parent::getDefaultTable($table)
            ->columns(static::getTableColumns())
            ->actions([
                Tables\Actions\ActionGroup::make([
                    Tables\Actions\EditAction::make(),
                    Tables\Actions\DeleteAction::make(),
                ]),
            ]);
    }

    public static function getTableColumns(): array
    {
        return [
            SpatieMediaLibraryImageColumn::make('thumbnail')
                ->collection(config('lunar.media.collection'))
                ->conversion('small')
                ->filterMediaUsing(fn ($media) => $media->where('custom_properties.primary', true)->count() ? $media->where('custom_properties.primary', true) : $media)
                ->limit(1)
                ->square()
                ->label(''),

            TranslatedTextColumn::make('attribute_data.name')
                ->attributeData()
                ->limitedTooltip()
                ->limit(50)
                ->label(__('lunarpanel::product.table.name.label'))
                ->description(fn ($record) => Str::limit(strip_tags((string) $record->translateAttribute('description')), 60) ?: null)
                ->searchable(),

            Tables\Columns\TextColumn::make('collections.name')
                ->label('Category')
                ->getStateUsing(fn ($record) => $record->collections->first()?->translateAttribute('name') ?? '—'),

            Tables\Columns\TextColumn::make('brand.name')
                ->label(__('lunarpanel::product.table.brand.label'))
                ->toggleable()
                ->searchable(),

            Tables\Columns\TextColumn::make('variants_sum_stock')
                ->label(__('lunarpanel::product.table.stock.label'))
                ->sum('variants', 'stock')
                ->icon(fn ($record) => $record->variants->count() === 1 ? 'heroicon-o-pencil-square' : null)
                ->iconPosition(IconPosition::After)
                ->action(
                    Tables\Actions\Action::make('quickEditStock')
                        ->label('Update Stock')
                        ->visible(fn ($record) => $record->variants->count() === 1)
                        ->form([
                            TextInput::make('stock')
                                ->label('Stock')
                                ->numeric()
                                ->required(),
                        ])
                        ->fillForm(fn ($record) => ['stock' => $record->variants->first()?->stock])
                        ->action(function ($record, array $data): void {
                            $record->variants->first()?->update(['stock' => $data['stock']]);
                        })
                ),

            Tables\Columns\TextColumn::make('price')
                ->label('Price')
                ->weight('bold')
                ->getStateUsing(function ($record) {
                    $price = $record->variants->first()?->prices->sortBy('min_quantity')->first();

                    return $price?->price?->formatted() ?? '—';
                }),

            Tables\Columns\TextColumn::make('status')
                ->label(__('lunarpanel::product.table.status.label'))
                ->badge()
                ->getStateUsing(fn ($record) => $record->deleted_at ? 'deleted' : $record->status)
                ->formatStateUsing(fn ($state) => __('lunarpanel::product.table.status.states.'.$state))
                ->color(fn (string $state): string => match ($state) {
                    'draft' => 'warning',
                    'published' => 'success',
                    'deleted' => 'danger',
                    default => 'primary',
                })
                ->icon(fn ($record) => $record->deleted_at ? null : 'heroicon-o-pencil-square')
                ->iconPosition(IconPosition::After)
                ->action(
                    Tables\Actions\Action::make('quickEditStatus')
                        ->label('Update Status')
                        ->visible(fn ($record) => ! $record->deleted_at)
                        ->form([
                            Select::make('status')
                                ->label('Status')
                                ->options([
                                    'draft' => __('lunarpanel::product.table.status.states.draft'),
                                    'published' => __('lunarpanel::product.table.status.states.published'),
                                ])
                                ->required(),
                        ])
                        ->fillForm(fn ($record) => ['status' => $record->status])
                        ->action(function ($record, array $data): void {
                            $record->update(['status' => $data['status']]);
                        })
                ),

            Tables\Columns\TextColumn::make('created_at')
                ->label('Created')
                ->date()
                ->sortable()
                ->toggleable(),
        ];
    }

    public static function getDefaultPages(): array
    {
        return array_merge(parent::getDefaultPages(), [
            'index' => ListProducts::route('/'),
        ]);
    }
}
