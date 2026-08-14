<?php

namespace App\Filament\Resources;

use App\Filament\Resources\SolutionResource\Pages;
use App\Models\Solution;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Forms\Set;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Support\Str;
use Lunar\Models\Product;

class SolutionResource extends Resource
{
    protected static ?string $model = Solution::class;

    protected static ?string $navigationIcon = 'heroicon-o-light-bulb';

    public static function getNavigationGroup(): ?string
    {
        return __('PetPosture');
    }

    protected static ?int $navigationSort = 2;

    public static function getLabel(): string
    {
        return __('Solution');
    }

    public static function getPluralLabel(): string
    {
        return __('Solutions');
    }

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
                Forms\Components\Textarea::make('description')
                    ->label(__('Description'))
                    ->columnSpanFull(),

                Forms\Components\Select::make('products')
                    ->label(__('Products'))
                    ->relationship('products', 'id')
                    ->multiple()
                    ->getOptionLabelFromRecordUsing(fn (Product $record) => $record->translateAttribute('name'))
                    ->searchable()
                    ->getSearchResultsUsing(fn (string $search) => Product::query()
                        ->where('attribute_data', 'like', "%{$search}%")
                        ->limit(50)
                        ->get()
                        ->mapWithKeys(fn (Product $product) => [$product->id => $product->translateAttribute('name')]))
                    ->preload()
                    ->columnSpanFull(),

                Forms\Components\Select::make('posts')
                    ->label(__('Posts'))
                    ->relationship('posts', 'title')
                    ->multiple()
                    ->searchable()
                    ->preload()
                    ->columnSpanFull(),

                Forms\Components\Section::make(__('SEO Settings'))
                    ->description(__('Optimize this solution page for search engines and social media.'))
                    ->schema([
                        Forms\Components\Tabs::make('SEO')
                            ->tabs([
                                Forms\Components\Tabs\Tab::make(__('Google Search'))
                                    ->schema([
                                        Forms\Components\TextInput::make('seo.title')
                                            ->label(__('SEO Title'))
                                            ->maxLength(60),
                                        Forms\Components\TextInput::make('seo.keyphrase')
                                            ->label(__('Focus Keyphrase')),
                                        Forms\Components\Textarea::make('seo.description')
                                            ->label(__('Meta Description'))
                                            ->maxLength(160),
                                    ]),
                                Forms\Components\Tabs\Tab::make(__('Social Media'))
                                    ->schema([
                                        Forms\Components\TextInput::make('seo.og_title')
                                            ->label(__('Social Title')),
                                        Forms\Components\Textarea::make('seo.og_description')
                                            ->label(__('Social Description')),
                                    ]),
                            ]),
                    ])->collapsible(),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('name')
                    ->label(__('Name'))
                    ->searchable(),
                Tables\Columns\TextColumn::make('slug')
                    ->label(__('Slug')),
                Tables\Columns\TextColumn::make('products_count')
                    ->label(__('Products'))
                    ->counts('products'),
                Tables\Columns\TextColumn::make('posts_count')
                    ->label(__('Posts'))
                    ->counts('posts'),
                Tables\Columns\TextColumn::make('created_at')
                    ->label(__('Created At'))
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
            'index' => Pages\ListSolutions::route('/'),
            'create' => Pages\CreateSolution::route('/create'),
            'edit' => Pages\EditSolution::route('/{record}/edit'),
        ];
    }
}
