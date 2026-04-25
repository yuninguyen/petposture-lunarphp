<?php

namespace App\Filament\Resources;

use App\Filament\Resources\ProductResource\Pages;
use Filament\Forms;
use Filament\Forms\Components\SpatieMediaLibraryFileUpload;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Columns\SpatieMediaLibraryImageColumn;
use Filament\Tables\Table;
use Illuminate\Support\Str;

class ProductResource extends Resource
{
    protected static ?string $navigationIcon = 'heroicon-o-shopping-bag';

    protected static ?int $navigationSort = 4;

    public static function getNavigationGroup(): ?string
    {
        return __('Ecommerce');
    }

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Tabs::make(__('Product Details'))
                    ->tabs([
                        Forms\Components\Tabs\Tab::make(__('General Information'))
                            ->icon('heroicon-m-information-circle')
                            ->schema([
                                Forms\Components\Group::make()
                                    ->schema([
                                        Forms\Components\Section::make()
                                            ->schema([
                                                Forms\Components\TextInput::make('name')
                                                    ->label(__('Name'))
                                                    ->required()
                                                    ->maxLength(255)
                                                    ->live(onBlur: true)
                                                    ->afterStateUpdated(fn ($state, callable $set) => $set('slug', Str::slug($state))),
                                                Forms\Components\TextInput::make('slug')
                                                    ->label(__('Slug'))
                                                    ->required()
                                                    ->unique(ignoreRecord: true)
                                                    ->maxLength(255),
                                                Forms\Components\RichEditor::make('description')
                                                    ->label(__('Description'))
                                                    ->required()
                                                    ->columnSpanFull(),
                                                Forms\Components\Textarea::make('embed_code')
                                                    ->label(__('Custom Embed Code (HTML)'))
                                                    ->placeholder(__('e.g. YouTube iframe or custom script'))
                                                    ->rows(5)
                                                    ->columnSpanFull(),
                                            ])->columns(2),
                                    ])->columnSpan(['lg' => 2]),

                                Forms\Components\Group::make()
                                    ->schema([
                                        Forms\Components\Section::make()
                                            ->schema([
                                                Forms\Components\Select::make('brand_id')
                                                    ->relationship('brand', 'name')
                                                    ->searchable()
                                                    ->preload()
                                                    ->label(__('Brand')),
                                                Forms\Components\Select::make('category_id')
                                                    ->label(__('Categories'))
                                                    ->relationship('category', 'name')
                                                    ->required()
                                                    ->searchable()
                                                    ->preload(),
                                                Forms\Components\TextInput::make('price')
                                                    ->label(__('Price'))
                                                    ->numeric()
                                                    ->prefix('$')
                                                    ->required(),
                                                Forms\Components\TextInput::make('old_price')
                                                    ->label(__('Old Price'))
                                                    ->numeric()
                                                    ->prefix('$'),
                                                Forms\Components\TextInput::make('stock_quantity')
                                                    ->label(__('Stock'))
                                                    ->numeric()
                                                    ->default(0)
                                                    ->required(),
                                            ]),

                                        Forms\Components\Section::make()
                                            ->schema([
                                                Forms\Components\TextInput::make('badge')
                                                    ->label(__('Badge'))
                                                    ->placeholder('e.g. 20% OFF'),
                                                Forms\Components\Toggle::make('is_new')
                                                    ->label(__('Mark as New'))
                                                    ->default(true),
                                                SpatieMediaLibraryFileUpload::make('product_image')
                                                    ->label(__('Main Image'))
                                                    ->image()
                                                    ->collection('product-images')
                                                    ->disk('public')
                                                    ->imageEditor(),
                                                Forms\Components\Toggle::make('is_active')
                                                    ->label(__('Visible in Store'))
                                                    ->default(true),
                                            ]),

                                        Forms\Components\Section::make(__('Tax'))
                                            ->description(__('Manage tax status and classes for this product.'))
                                            ->schema([
                                                Forms\Components\Select::make('tax_status')
                                                    ->label(__('Tax Status'))
                                                    ->options([
                                                        'taxable' => __('Taxable'),
                                                        'shipping' => __('Shipping only'),
                                                        'none' => __('None'),
                                                    ])
                                                    ->default('taxable'),
                                                Forms\Components\Select::make('tax_class')
                                                    ->label(__('Tax Class'))
                                                    ->options([
                                                        'standard' => __('Standard'),
                                                        'reduced-rate' => __('Reduced rate'),
                                                        'zero-rate' => __('Zero rate'),
                                                    ])
                                                    ->default('standard'),
                                            ])->columns(2),

                                        Forms\Components\Section::make(__('Storefront Variant Mode'))
                                            ->description(__('Catalog authoring currently syncs one default sellable variant into Lunar for storefront and checkout.'))
                                            ->schema([
                                                Forms\Components\Placeholder::make('variant_sync_notice')
                                                    ->label(__('Legacy Variants Disabled'))
                                                    ->content(__('Legacy variant authoring is disabled because storefront purchasing uses Lunar variants. Re-enable this only after multi-variant sync into Lunar is implemented.')),
                                            ]),
                                    ])->columnSpan(['lg' => 1]),
                            ])->columns(3),

                        Forms\Components\Tabs\Tab::make(__('Shipping'))
                            ->icon('heroicon-m-truck')
                            ->schema([
                                Forms\Components\Section::make(__('Weight & Dimensions'))
                                    ->schema([
                                        Forms\Components\TextInput::make('weight')
                                            ->numeric()
                                            ->label(__('Weight (lbs)'))
                                            ->placeholder('0.00'),
                                        Forms\Components\Grid::make(3)
                                            ->schema([
                                                Forms\Components\TextInput::make('length')
                                                    ->numeric()
                                                    ->label(__('Length (cm)')),
                                                Forms\Components\TextInput::make('width')
                                                    ->numeric()
                                                    ->label(__('Width (cm)')),
                                                Forms\Components\TextInput::make('height')
                                                    ->numeric()
                                                    ->label(__('Height (cm)')),
                                            ]),
                                    ]),
                                Forms\Components\Section::make(__('Shipping Class'))
                                    ->schema([
                                        Forms\Components\Select::make('shipping_class')
                                            ->label(__('Shipping Class'))
                                            ->options([
                                                'standard' => __('No shipping class'),
                                                'heavy' => __('Heavy items'),
                                                'fragile' => __('Fragile items'),
                                            ])
                                            ->default('standard'),
                                    ]),
                            ]),

                        Forms\Components\Tabs\Tab::make(__('Additional Metadata'))
                            ->icon('heroicon-m-list-bullet')
                            ->schema([
                                Forms\Components\Repeater::make('metadata_repeater')
                                    ->label(__('Properties'))
                                    ->relationship('metadata')
                                    ->schema([
                                        Forms\Components\TextInput::make('key')
                                            ->label(__('Key'))
                                            ->placeholder('e.g. material')
                                            ->required(),
                                        Forms\Components\TextInput::make('value')
                                            ->label(__('Value'))
                                            ->placeholder('e.g. 100% Cotton')
                                            ->required(),
                                    ])
                                    ->columns(2)
                                    ->defaultItems(0)
                                    ->addActionLabel(__('Add Property')),
                            ]),

                        Forms\Components\Tabs\Tab::make(__('SEO Settings'))
                            ->icon('heroicon-m-globe-alt')
                            ->schema([
                                Forms\Components\Section::make(__('Search Appearance'))
                                    ->description(__('Configure how this product appears in search engines.'))
                                    ->schema([
                                        Forms\Components\TextInput::make('seo.title')
                                            ->label(__('SEO Title'))
                                            ->placeholder(__('Leave empty to use main product name'))
                                            ->maxLength(60)
                                            ->helperText(__('Ideal: 50-60 characters.')),
                                        Forms\Components\TextInput::make('seo.keyphrase')
                                            ->label(__('Focus Keyphrase'))
                                            ->placeholder(__('e.g. ergonomic pet posture bed')),
                                        Forms\Components\Textarea::make('seo.description')
                                            ->label(__('Meta Description'))
                                            ->maxLength(160)
                                            ->helperText(__('Ideal: 120-160 characters.')),
                                    ]),

                                Forms\Components\Section::make(__('Social Media (Open Graph)'))
                                    ->description(__('Customize how this product looks when shared on Facebook, Zalo, etc.'))
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
                    ]),
            ])->columns(1);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                SpatieMediaLibraryImageColumn::make('product_image')
                    ->label('Thumbnail')
                    ->collection('product-images')
                    ->conversion('thumb')
                    ->square(),
                Tables\Columns\TextColumn::make('name')
                    ->searchable()
                    ->sortable(),
                Tables\Columns\TextColumn::make('category.name')
                    ->sortable(),
                Tables\Columns\TextColumn::make('price')
                    ->money()
                    ->sortable(),
                Tables\Columns\TextColumn::make('stock_quantity')
                    ->label('Stock')
                    ->sortable(),
                Tables\Columns\IconColumn::make('is_active')
                    ->boolean()
                    ->label('Visible'),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('category')
                    ->relationship('category', 'name'),
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
        return [];
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListProducts::route('/'),
            'create' => Pages\CreateProduct::route('/create'),
            'edit' => Pages\EditProduct::route('/{record}/edit'),
        ];
    }
}
