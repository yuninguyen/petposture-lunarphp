<?php

namespace App\Filament\Resources;

use App\Filament\Resources\PostResource\Pages;
use App\Models\Post;
use Filament\Forms;
use Filament\Forms\Form;
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
                            ->afterStateUpdated(fn(string $operation, $state, Forms\Set $set) =>
                                $operation === 'create' ? $set('slug', Str::slug($state)) : null),

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

                        Forms\Components\FileUpload::make('featured_image')
                            ->label(__('Featured Image'))
                            ->image()
                            ->directory('blog'),

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

                        Forms\Components\Textarea::make('embed_code')
                            ->label(__('Custom Embed Code (HTML)'))
                            ->placeholder(__('e.g. YouTube iframe or custom script'))
                            ->rows(5)
                            ->columnSpanFull(),
                    ])->columns(2),

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
                Tables\Columns\ImageColumn::make('featured_image')
                    ->label(__('Featured Image')),
                Tables\Columns\TextColumn::make('title')
                    ->label(__('Title'))
                    ->searchable()
                    ->sortable(),
                Tables\Columns\TextColumn::make('status')
                    ->label(__('Status'))
                    ->badge()
                    ->color(fn(string $state): string => match ($state) {
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

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListPosts::route('/'),
            'create' => Pages\CreatePost::route('/create'),
            'edit' => Pages\EditPost::route('/{record}/edit'),
        ];
    }
}
