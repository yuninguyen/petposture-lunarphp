<?php

namespace App\Filament\Resources;

use App\Filament\Resources\CategoryResource\Pages;
use App\Models\Category;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Support\Str;

class CategoryResource extends Resource
{
    protected static ?string $model = Category::class;

    protected static ?string $navigationIcon = 'heroicon-o-rectangle-stack';

    public static function getNavigationGroup(): ?string
    {
        return __('Ecommerce');
    }
    protected static ?int $navigationSort = 1;

    public static function getLabel(): string
    {
        return __('Category');
    }

    public static function getPluralLabel(): string
    {
        return __('Categories');
    }

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\TextInput::make('name')
                    ->label(__('Name'))
                    ->required()
                    ->live(onBlur: true)
                    ->afterStateUpdated(fn(string $operation, $state, Forms\Set $set) =>
                        $operation === 'create' ? $set('slug', Str::slug($state)) : null),
                Forms\Components\TextInput::make('slug')
                    ->label(__('Slug'))
                    ->required()
                    ->unique(ignoreRecord: true),
                Forms\Components\Textarea::make('description')
                    ->label(__('Description'))
                    ->columnSpanFull(),
                Forms\Components\TextInput::make('image_url')
                    ->label(__('Thumbnail URL')),

                Forms\Components\Section::make(__('SEO Settings'))
                    ->description(__('Optimize this category for search engines and social media.'))
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
                                        Forms\Components\FileUpload::make('seo.og_image')
                                            ->label(__('Social Image'))
                                            ->image()
                                            ->directory('seo'),
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
            'index' => Pages\ListCategories::route('/'),
            'create' => Pages\CreateCategory::route('/create'),
            'edit' => Pages\EditCategory::route('/{record}/edit'),
        ];
    }
}
