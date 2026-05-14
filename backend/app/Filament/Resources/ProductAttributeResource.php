<?php

namespace App\Filament\Resources;

use App\Filament\Resources\ProductAttributeResource\Pages;
use App\Models\ProductAttribute;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

class ProductAttributeResource extends Resource
{
    protected static ?string $model = ProductAttribute::class;

    public static function getNavigationLabel(): string
    {
        return __('admin.resources.product_attributes.navigation_label');
    }

    public static function getModelLabel(): string
    {
        return __('admin.resources.product_attributes.label');
    }

    public static function getPluralModelLabel(): string
    {
        return __('admin.resources.product_attributes.plural_label');
    }

    public static function getNavigationGroup(): ?string
    {
        return __('lunarpanel::global.sections.catalog');
    }

    protected static ?int $navigationSort = 3;

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Section::make(__('admin.resources.product_attributes.sections.details'))
                    ->schema([
                        Forms\Components\TextInput::make('name')
                            ->label(__('admin.resources.product_attributes.attributes.name'))
                            ->required()
                            ->maxLength(255)
                            ->live(onBlur: true)
                            ->afterStateUpdated(fn($state, callable $set) => $set('handle', \Illuminate\Support\Str::slug($state))),
                        Forms\Components\TextInput::make('handle')
                            ->label(__('admin.resources.product_attributes.attributes.handle'))
                            ->required()
                            ->unique(ignoreRecord: true)
                            ->maxLength(255),
                    ]),

                Forms\Components\Section::make(__('admin.resources.product_attributes.sections.values'))
                    ->description(__('admin.resources.product_attributes.sections.values_description'))
                    ->schema([
                        Forms\Components\Repeater::make('values')
                            ->label(__('admin.resources.product_attributes.attributes.values'))
                            ->relationship('values')
                            ->schema([
                                Forms\Components\TextInput::make('value')
                                    ->required()
                                    ->maxLength(255),
                            ])
                            ->defaultItems(1)
                            ->columns(1),
                    ]),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('name')
                    ->label(__('admin.resources.product_attributes.attributes.name'))
                    ->searchable()
                    ->sortable(),
                Tables\Columns\TextColumn::make('handle')
                    ->label(__('admin.resources.product_attributes.attributes.handle'))
                    ->fontFamily('mono')
                    ->color('gray'),
                Tables\Columns\TextColumn::make('values_count')
                    ->counts('values')
                    ->label(__('admin.resources.product_attributes.attributes.values_count')),
                Tables\Columns\TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                //
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
            'index' => Pages\ListProductAttributes::route('/'),
            'create' => Pages\CreateProductAttribute::route('/create'),
            'edit' => Pages\EditProductAttribute::route('/{record}/edit'),
        ];
    }
}
