<?php

namespace App\Filament\Resources;

use App\Filament\Resources\UserResource\Pages\CreateUser;
use App\Filament\Resources\UserResource\Pages\EditUser;
use App\Filament\Resources\UserResource\Pages\ListUsers;
use App\Filament\Resources\UserResource\Pages\ViewUser;
use App\Models\User;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Hash;

class UserResource extends Resource
{
    protected static ?string $model = User::class;

    protected static ?string $navigationIcon = 'heroicon-o-users';

    public static function getNavigationGroup(): ?string
    {
        return __('System');
    }

    public static function getLabel(): string
    {
        return __('User');
    }

    public static function getPluralLabel(): string
    {
        return __('Users');
    }

    public static function getEloquentQuery(): Builder
    {
        // Mirrors the staff role list in App\Models\User::canAccessPanel() — keep in sync.
        return parent::getEloquentQuery()->whereHas('roles', fn (Builder $query) => $query->whereIn('name', ['super_admin', 'admin', 'staff', 'Product Manager', 'Order Manager', 'Support'])
        );
    }

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Section::make(__('User Details'))
                    ->schema([
                        Forms\Components\TextInput::make('name')
                            ->label(__('Name'))
                            ->required()
                            ->maxLength(255),
                        Forms\Components\TextInput::make('email')
                            ->label(__('Email'))
                            ->email()
                            ->required()
                            ->maxLength(255)
                            ->unique(ignoreRecord: true),
                        Forms\Components\TextInput::make('password')
                            ->label(__('Password'))
                            ->password()
                            ->revealable()
                            ->dehydrateStateUsing(fn ($state) => Hash::make($state))
                            ->dehydrated(fn ($state) => filled($state))
                            ->required(fn (string $context): bool => $context === 'create'),
                    ])->columns(2),

                Forms\Components\Section::make(__('Access Control'))
                    ->schema([
                        Forms\Components\Grid::make(2)->schema([
                            Forms\Components\Select::make('roles')
                                ->label(__('Roles'))
                                ->relationship('roles', 'name', fn (Builder $query) => $query->where('guard_name', 'web'))
                                ->getOptionLabelFromRecordUsing(fn ($record) => str($record->name)->headline())
                                ->multiple()
                                ->preload()
                                ->searchable()
                                ->required()
                                ->columnSpan(1),
                            Forms\Components\Toggle::make('is_active')
                                ->label(__('Status'))
                                ->inline(false)
                                ->helperText(__('Inactive users cannot sign in to the admin panel.'))
                                ->default(true)
                                ->columnSpan(1),
                        ]),
                    ]),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('name')
                    ->label(__('Name'))
                    ->searchable(),
                Tables\Columns\TextColumn::make('email')
                    ->label(__('Email'))
                    ->searchable(),
                Tables\Columns\TextColumn::make('roles.name')
                    ->label(__('Role'))
                    ->badge()
                    ->formatStateUsing(fn (string $state): string => str($state)->headline())
                    ->color('info'),
                Tables\Columns\IconColumn::make('is_active')
                    ->label(__('Status'))
                    ->boolean()
                    ->trueIcon('heroicon-o-check-circle')
                    ->falseIcon('heroicon-o-x-circle')
                    ->trueColor('success')
                    ->falseColor('danger'),
                Tables\Columns\TextColumn::make('last_login_at')
                    ->label(__('Last Login'))
                    ->dateTime()
                    ->placeholder(__('Never'))
                    ->sortable(),
            ])
            ->filters([
                //
            ])
            ->actions([
                Tables\Actions\ViewAction::make(),
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
            'index' => ListUsers::route('/'),
            'create' => CreateUser::route('/create'),
            'view' => ViewUser::route('/{record}'),
            'edit' => EditUser::route('/{record}/edit'),
        ];
    }
}
