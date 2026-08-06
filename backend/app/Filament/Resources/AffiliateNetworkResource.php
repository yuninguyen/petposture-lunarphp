<?php

namespace App\Filament\Resources;

use App\Filament\Resources\AffiliateNetworkResource\Pages;
use App\Models\AffiliateNetwork;
use App\Support\ImageUploadResizer;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Forms\Set;
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
            ])
            ->filters([
                //
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
            'index' => Pages\ListAffiliateNetworks::route('/'),
            'create' => Pages\CreateAffiliateNetwork::route('/create'),
            'edit' => Pages\EditAffiliateNetwork::route('/{record}/edit'),
        ];
    }
}
