<?php

namespace App\Filament\Resources\ProductResource\RelationManagers;

use Filament\Forms;
use Filament\Forms\Components\SpatieMediaLibraryFileUpload;
use Filament\Forms\Form;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables;
use Filament\Tables\Columns\SpatieMediaLibraryImageColumn;
use Filament\Tables\Table;

class VariantsRelationManager extends RelationManager
{
    /**
     * @deprecated Legacy variant authoring is disabled in ProductResource until
     * real multi-variant sync into Lunar exists. This relation manager is kept
     * only as a reference surface and should not be re-enabled casually.
     */
    protected static string $relationship = 'variants';

    protected static ?string $recordTitleAttribute = 'sku';

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\TextInput::make('sku')
                    ->label('SKU')
                    ->required()
                    ->unique(ignoreRecord: true)
                    ->maxLength(255),
                Forms\Components\TextInput::make('price')
                    ->label('Price')
                    ->numeric()
                    ->prefix('$'),
                Forms\Components\TextInput::make('stock')
                    ->numeric()
                    ->default(0),

                Forms\Components\Select::make('attributeValues')
                    ->multiple()
                    ->relationship('attributeValues', 'value')
                    ->getOptionLabelFromRecordUsing(fn ($record) => "{$record->attribute->name}: {$record->value}")
                    ->preload()
                    ->label('Attribute Combinations')
                    ->helperText('Select the attributes that define this SKU (e.g. Color: Red AND Size: XL)'),

                SpatieMediaLibraryFileUpload::make('variant_image')
                    ->label('Variant Image')
                    ->image()
                    ->collection('variant-images')
                    ->disk('public')
                    ->columnSpanFull(),
            ]);
    }

    public function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('sku')
                    ->sortable()
                    ->searchable(),
                SpatieMediaLibraryImageColumn::make('variant_image')
                    ->label('Image')
                    ->collection('variant-images')
                    ->conversion('thumb')
                    ->square(),
                Tables\Columns\TextColumn::make('price')
                    ->money()
                    ->sortable(),
                Tables\Columns\TextColumn::make('stock')
                    ->sortable(),
                Tables\Columns\TextColumn::make('attributeValues.value')
                    ->badge()
                    ->label('Attributes')
                    ->getStateUsing(fn ($record) => $record->attributeValues->map(fn ($av) => "{$av->attribute->name}: {$av->value}")->toArray()),
            ])
            ->filters([
                //
            ])
            ->headerActions([
                Tables\Actions\CreateAction::make(),
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
}
