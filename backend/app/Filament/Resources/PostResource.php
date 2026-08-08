<?php

namespace App\Filament\Resources;

use App\Filament\Resources\PostResource\Pages;
use App\Models\AffiliateNetwork;
use App\Models\Post;
use App\Models\User;
use App\Services\AiSeoGeneratorService;
use App\Support\ImageUploadResizer;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Forms\Get;
use Filament\Forms\Set;
use Filament\Notifications\Notification;
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
                Forms\Components\Grid::make(['default' => 1, 'lg' => 3])
                    ->schema([
                        Forms\Components\Group::make([
                            static::contentSection(),
                            static::comparisonDetailsSection(),
                            static::seoSection(),
                        ])->columnSpan(['lg' => 2]),

                        Forms\Components\Group::make([
                            static::postSettingsSection(),
                        ])->columnSpan(['lg' => 1]),
                    ]),
            ]);
    }

    protected static function contentSection(): Forms\Components\Section
    {
        return Forms\Components\Section::make(__('Content'))
            ->description(__('The title and body of the post.'))
            ->schema([
                Forms\Components\View::make('filament.forms.autosave-draft')
                    ->columnSpanFull(),

                Forms\Components\TextInput::make('title')
                    ->label(__('Title'))
                    ->required()
                    ->maxLength(255)
                    ->live(onBlur: true)
                    ->afterStateUpdated(fn (string $operation, $state, Set $set) => $operation === 'create' ? $set('slug', Str::slug($state)) : null)
                    ->columnSpanFull(),

                Forms\Components\TextInput::make('slug')
                    ->label(__('Slug'))
                    ->required()
                    ->unique(Post::class, 'slug', ignoreRecord: true)
                    ->maxLength(255)
                    ->live(onBlur: true)
                    ->columnSpanFull(),

                Forms\Components\RichEditor::make('content')
                    ->label(__('Content'))
                    ->required()
                    ->columnSpanFull(),
            ]);
    }

    protected static function postSettingsSection(): Forms\Components\Section
    {
        return Forms\Components\Section::make(__('Post Settings'))
            ->schema([
                Forms\Components\Select::make('blog_category_id')
                    ->label(__('Category'))
                    ->relationship('blogCategory', 'name')
                    ->required()
                    ->searchable()
                    ->preload()
                    ->createOptionForm([
                        Forms\Components\TextInput::make('name')
                            ->label(__('Name'))
                            ->required()
                            ->live(onBlur: true)
                            ->afterStateUpdated(fn ($state, Set $set) => $set('slug', Str::slug($state))),
                        Forms\Components\TextInput::make('slug')
                            ->label(__('Slug'))
                            ->required()
                            ->unique('blog_categories', 'slug'),
                    ]),

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

                Forms\Components\Select::make('author')
                    ->label(__('Author'))
                    ->options(fn () => User::orderBy('name')->pluck('name', 'name'))
                    ->default(fn () => auth()->user()?->name)
                    ->searchable(),

                Forms\Components\FileUpload::make('featured_image')
                    ->label(__('Featured Image'))
                    ->image()
                    ->directory('blog')
                    ->saveUploadedFileUsing(ImageUploadResizer::make(1600, 1600)),

                Forms\Components\TextInput::make('featured_image_alt')
                    ->label(__('Image Alt Text'))
                    ->helperText(__('Describe the image for search engines and screen readers.'))
                    ->maxLength(255),

                Forms\Components\Select::make('status')
                    ->label(__('Status'))
                    ->options([
                        'draft' => __('Draft'),
                        'published' => __('Published'),
                    ])
                    ->required()
                    ->default('draft')
                    ->live(),

                Forms\Components\DateTimePicker::make('published_at')
                    ->label(__('Published At')),
            ]);
    }

    protected static function comparisonDetailsSection(): Forms\Components\Section
    {
        return Forms\Components\Section::make(__('Comparison Details'))
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
                    ]);
    }

    protected static function seoSection(): Forms\Components\Section
    {
        return Forms\Components\Section::make(__('SEO Settings'))
                    ->description(__('Optimize this post for search engines and social media.'))
                    ->headerActions([
                        Forms\Components\Actions\Action::make('generateSeo')
                            ->label(__('Generate with AI'))
                            ->icon('heroicon-o-sparkles')
                            ->color('gray')
                            ->action(function (Get $get, Set $set) {
                                $title = (string) $get('title');
                                $content = (string) $get('content');

                                if (blank($title)) {
                                    Notification::make()
                                        ->title(__('Add a title first'))
                                        ->warning()
                                        ->send();

                                    return;
                                }

                                try {
                                    $result = app(AiSeoGeneratorService::class)->generate($title, $content);
                                } catch (\Throwable $e) {
                                    Notification::make()
                                        ->title(__('SEO generation failed'))
                                        ->body($e->getMessage())
                                        ->danger()
                                        ->send();

                                    return;
                                }

                                $set('seo.title', $result['seo_title']);
                                $set('seo.keyphrase', $result['focus_keyphrase']);
                                $set('seo.description', $result['meta_description']);
                                $set('seo.og_title', $result['social_title']);
                                $set('seo.og_description', $result['social_description']);

                                Notification::make()
                                    ->title(__('SEO fields generated — review before saving'))
                                    ->success()
                                    ->send();
                            }),
                    ])
                    ->schema([
                        Forms\Components\Tabs::make('SEO')
                            ->tabs([
                                Forms\Components\Tabs\Tab::make(__('Google Search'))
                                    ->schema([
                                        Forms\Components\TextInput::make('seo.title')
                                            ->label(__('SEO Title'))
                                            ->maxLength(60)
                                            ->live(onBlur: true),
                                        Forms\Components\TextInput::make('seo.keyphrase')
                                            ->label(__('Focus Keyphrase')),
                                        Forms\Components\Textarea::make('seo.description')
                                            ->label(__('Meta Description'))
                                            ->maxLength(160)
                                            ->live(onBlur: true),
                                        Forms\Components\Placeholder::make('serp_preview')
                                            ->label(__('Search Preview'))
                                            ->content(function (Get $get) {
                                                $title = Str::limit((string) ($get('seo.title') ?: $get('title') ?: __('Untitled Post')), 60, '');
                                                $description = Str::limit((string) ($get('seo.description') ?: strip_tags((string) $get('content'))), 160, '');
                                                $url = rtrim(config('app.frontend_url'), '/').'/blog/'.($get('slug') ?: 'post-slug');

                                                return new \Illuminate\Support\HtmlString(
                                                    view('filament.forms.serp-preview', compact('title', 'description', 'url'))->render()
                                                );
                                            }),
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
                    ])->collapsible();
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
                    Tables\Actions\ReplicateAction::make()
                        ->label(__('Duplicate'))
                        ->beforeReplicaSaved(function (Post $replica) {
                            $replica->title = $replica->title.' '.__('(Copy)');
                            $replica->slug = Str::slug($replica->title).'-'.Str::random(6);
                            $replica->status = 'draft';
                            $replica->published_at = null;
                        })
                        ->after(function (Post $record, Post $replica) {
                            foreach ($record->metadata as $meta) {
                                $replica->setMeta($meta->key, $meta->cast_value, $meta->type);
                            }

                            if ($record->seo) {
                                $replica->seo()->create($record->seo->only([
                                    'title', 'keyphrase', 'description', 'og_title', 'og_description', 'og_image',
                                ]));
                            }
                        })
                        ->successRedirectUrl(fn (Post $replica) => static::getUrl('edit', ['record' => $replica])),
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
