<?php

namespace App\Filament\Resources;

use App\Filament\Resources\PostResource\Pages;
use App\Models\AffiliateNetwork;
use App\Models\Post;
use App\Support\ImageUploadResizer;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Forms\Get;
use Filament\Forms\Set;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Support\Str;

class PostResource extends Resource
{
    protected static ?string $model = Post::class;

    protected static ?string $navigationIcon = 'heroicon-o-document-text';

    public static function getNavigationGroup(): ?string
    {
        return __('Content Management');
    }

    public static function getLabel(): string
    {
        return __('Post');
    }

    public static function getPluralLabel(): string
    {
        return __('Posts');
    }

    protected static ?int $navigationSort = 2;

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Section::make(__('Post Details'))
                    ->schema([
                        Forms\Components\TextInput::make('title')
                            ->label(__('Title'))
                            ->required()
                            ->maxLength(255)
                            ->live(onBlur: true)
                            ->afterStateUpdated(fn (string $operation, $state, Set $set) => $operation === 'create' ? $set('slug', Str::slug($state)) : null),

                        Forms\Components\TextInput::make('slug')
                            ->label(__('Slug'))
                            ->required()
                            ->unique(Post::class, 'slug', ignoreRecord: true)
                            ->maxLength(255),

                        Forms\Components\RichEditor::make('content')
                            ->label(__('Content'))
                            ->required()
                            ->columnSpanFull(),

                        Forms\Components\Select::make('blog_category_id')
                            ->label(__('Category'))
                            ->relationship('blogCategory', 'name')
                            ->required()
                            ->searchable()
                            ->preload(),

                        Forms\Components\Select::make('type')
                            ->label(__('Post Type'))
                            ->options([
                                Post::TYPE_ARTICLE => __('Article'),
                                Post::TYPE_GUIDE => __('Guide'),
                                Post::TYPE_COMPARISON => __('Comparison'),
                            ])
                            ->default(Post::TYPE_ARTICLE)
                            ->required()
                            ->live(),

                        Forms\Components\FileUpload::make('featured_image')
                            ->label(__('Featured Image'))
                            ->image()
                            ->directory('blog')
                            ->saveUploadedFileUsing(ImageUploadResizer::make(1600, 1600)),

                        Forms\Components\Select::make('status')
                            ->label(__('Status'))
                            ->options([
                                'draft' => __('Draft'),
                                'published' => __('Published'),
                            ])
                            ->required()
                            ->default('draft'),

                        Forms\Components\DateTimePicker::make('published_at')
                            ->label(__('Published At')),

                    ])->columns(2),

                Forms\Components\Section::make(__('Comparison Details'))
                    ->description(__('Retailer price comparison shown above the article body. Only used when post type is Comparison.'))
                    ->visible(fn (Get $get): bool => $get('type') === Post::TYPE_COMPARISON)
                    ->schema([
                        Forms\Components\Textarea::make('metadata.comparison_intro')
                            ->label(__('Intro'))
                            ->rows(2)
                            ->columnSpanFull(),

                        Forms\Components\Toggle::make('metadata.disclosure_shown')
                            ->label(__('Show affiliate disclosure banner'))
                            ->default(true)
                            ->columnSpanFull(),

                        Forms\Components\Repeater::make('metadata.comparison_items')
                            ->label(__('Comparison Items'))
                            ->columnSpanFull()
                            ->collapsible()
                            ->itemLabel(fn (array $state): ?string => $state['product_name'] ?? null)
                            ->schema([
                                Forms\Components\TextInput::make('product_name')
                                    ->label(__('Product Name'))
                                    ->required(),

                                Forms\Components\FileUpload::make('image_url')
                                    ->label(__('Image'))
                                    ->image()
                                    ->directory('comparisons')
                                    ->saveUploadedFileUsing(ImageUploadResizer::make(800, 800)),

                                Forms\Components\Select::make('retailer')
                                    ->label(__('Retailer'))
                                    ->options(fn () => AffiliateNetwork::where('active', true)->pluck('name', 'slug'))
                                    ->helperText(__('Manage the list under Content Management → Affiliate Networks.'))
                                    ->required(),

                                Forms\Components\Select::make('highlight')
                                    ->label(__('Highlight'))
                                    ->options([
                                        'best_overall' => __('Best Overall'),
                                        'best_value' => __('Best Value'),
                                        'budget_pick' => __('Budget Pick'),
                                    ])
                                    ->placeholder(__('None')),

                                Forms\Components\TextInput::make('price_display')
                                    ->label(__('Price (display)'))
                                    ->placeholder('$64.99')
                                    ->required(),

                                Forms\Components\TextInput::make('price_cents')
                                    ->label(__('Price (cents, for sorting)'))
                                    ->numeric()
                                    ->required(),

                                Forms\Components\TextInput::make('rating')
                                    ->label(__('Rating (0–5)'))
                                    ->numeric()
                                    ->minValue(0)
                                    ->maxValue(5)
                                    ->step(0.1),

                                Forms\Components\TextInput::make('affiliate_url')
                                    ->label(__('Affiliate URL'))
                                    ->url()
                                    ->required()
                                    ->columnSpanFull(),

                                Forms\Components\TagsInput::make('pros')
                                    ->label(__('Pros')),

                                Forms\Components\TagsInput::make('cons')
                                    ->label(__('Cons')),

                                Forms\Components\TextInput::make('in_house_match_url')
                                    ->label(__('We carry a similar product (URL, optional)'))
                                    ->url()
                                    ->columnSpanFull(),
                            ])
                            ->columns(2),
                    ]),

                Forms\Components\Section::make(__('SEO Settings'))
                    ->description(__('Optimize this post for search engines and social media.'))
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
                                            ->directory('seo')
                                            ->saveUploadedFileUsing(ImageUploadResizer::make(1200, 630)),
                                    ]),
                            ]),
                    ])->collapsible(),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\ImageColumn::make('featured_image')
                    ->label(__('Featured Image')),
                Tables\Columns\TextColumn::make('title')
                    ->label(__('Title'))
                    ->searchable()
                    ->sortable(),
                Tables\Columns\TextColumn::make('type')
                    ->label(__('Type'))
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        Post::TYPE_COMPARISON => 'warning',
                        Post::TYPE_GUIDE => 'info',
                        default => 'gray',
                    }),
                Tables\Columns\TextColumn::make('status')
                    ->label(__('Status'))
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'draft' => 'gray',
                        'published' => 'success',
                        default => 'gray',
                    }),
                Tables\Columns\TextColumn::make('published_at')
                    ->label(__('Published At'))
                    ->dateTime()
                    ->sortable(),
                Tables\Columns\TextColumn::make('created_at')
                    ->label(__('Created At'))
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('status')
                    ->options([
                        'draft' => 'Draft',
                        'published' => 'Published',
                    ]),
                Tables\Filters\SelectFilter::make('type')
                    ->options([
                        Post::TYPE_ARTICLE => 'Article',
                        Post::TYPE_GUIDE => 'Guide',
                        Post::TYPE_COMPARISON => 'Comparison',
                    ]),
            ])
            ->actions([
                Tables\Actions\ActionGroup::make([
                    Tables\Actions\EditAction::make(),
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
            'index' => Pages\ListPosts::route('/'),
            'create' => Pages\CreatePost::route('/create'),
            'edit' => Pages\EditPost::route('/{record}/edit'),
        ];
    }
}
