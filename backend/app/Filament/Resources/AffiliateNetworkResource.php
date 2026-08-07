<?php

namespace App\Filament\Resources;

use App\Filament\Resources\AffiliateNetworkResource\Pages;
use App\Filament\Resources\AffiliateNetworkResource\RelationManagers\ReportsRelationManager;
use App\Jobs\SyncAffiliateReportJob;
use App\Models\AffiliateNetwork;
use App\Support\ImageUploadResizer;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Forms\Set;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Support\Str;

class AffiliateNetworkResource extends Resource
{
    protected static ?string $model = AffiliateNetwork::class;

    protected static ?string $navigationIcon = 'heroicon-o-link';

    public static function getNavigationGroup(): ?string
    {
        return __('Content Management');
    }

    public static function getLabel(): string
    {
        return __('Affiliate Network');
    }

    public static function getPluralLabel(): string
    {
        return __('Affiliate Networks');
    }

    protected static ?int $navigationSort = 3;

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
                    ->unique(ignoreRecord: true)
                    ->helperText(__('Used as the stable key stored on comparison items — avoid changing after it is used in a post.')),

                Forms\Components\FileUpload::make('logo')
                    ->label(__('Logo'))
                    ->image()
                    ->directory('affiliate-networks')
                    ->saveUploadedFileUsing(ImageUploadResizer::make(300, 300)),

                Forms\Components\Toggle::make('active')
                    ->label(__('Active'))
                    ->default(true)
                    ->helperText(__('Inactive networks stay on existing posts but no longer appear when adding new comparison items.')),

                Forms\Components\Section::make(__('API Sync (optional)'))
                    ->description(__('Leave blank until this network has an approved affiliate account with real API access. Without a provider, this network is manual-only (links entered by hand on comparison posts) — the same as today.'))
                    ->schema([
                        Forms\Components\Select::make('provider')
                            ->label(__('API Provider'))
                            ->options([
                                'amazon_pa_api' => 'Amazon Product Advertising API',
                                'impact' => 'Impact.com',
                                'cj' => 'CJ (Commission Junction)',
                            ])
                            ->native(false)
                            ->placeholder(__('None — manual only')),

                        Forms\Components\TextInput::make('merchant_id')
                            ->label(__('Merchant / Publisher ID')),

                        Forms\Components\TextInput::make('api_key')
                            ->label(__('API Key'))
                            ->password()
                            ->revealable(),

                        Forms\Components\TextInput::make('api_secret')
                            ->label(__('API Secret'))
                            ->password()
                            ->revealable(),

                        Forms\Components\TextInput::make('commission_rate_default')
                            ->label(__('Default Commission Rate'))
                            ->placeholder('4.7%')
                            ->helperText(__('Informational only — for admin reference.')),

                        Forms\Components\TextInput::make('cookie_days')
                            ->label(__('Cookie Duration (days)'))
                            ->numeric()
                            ->helperText(__('Informational only — for admin reference.')),

                        Forms\Components\Placeholder::make('last_synced_at')
                            ->label(__('Last Synced'))
                            ->content(fn (?AffiliateNetwork $record) => $record?->last_synced_at?->diffForHumans() ?? __('Never')),
                    ])
                    ->columns(2),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\ImageColumn::make('logo')
                    ->label(__('Logo')),
                Tables\Columns\TextColumn::make('name')
                    ->label(__('Name'))
                    ->searchable()
                    ->sortable(),
                Tables\Columns\TextColumn::make('slug')
                    ->label(__('Slug')),
                Tables\Columns\IconColumn::make('active')
                    ->label(__('Active'))
                    ->boolean(),
                Tables\Columns\TextColumn::make('last_synced_at')
                    ->label(__('Last Synced'))
                    ->since()
                    ->placeholder(__('Never')),
            ])
            ->filters([
                //
            ])
            ->actions([
                Tables\Actions\ActionGroup::make([
                    Tables\Actions\Action::make('syncNow')
                        ->label(__('Sync Now'))
                        ->icon('heroicon-o-arrow-path')
                        ->visible(fn (AffiliateNetwork $record): bool => filled($record->provider))
                        ->action(function (AffiliateNetwork $record) {
                            SyncAffiliateReportJob::dispatchSync($record->id);

                            Notification::make()
                                ->title(__('Sync triggered'))
                                ->body(__('Reports for :network are syncing now.', ['network' => $record->name]))
                                ->success()
                                ->send();
                        }),
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
            'index' => Pages\ListAffiliateNetworks::route('/'),
            'create' => Pages\CreateAffiliateNetwork::route('/create'),
            'edit' => Pages\EditAffiliateNetwork::route('/{record}/edit'),
        ];
    }

    public static function getRelations(): array
    {
        return [
            ReportsRelationManager::class,
        ];
    }
}
