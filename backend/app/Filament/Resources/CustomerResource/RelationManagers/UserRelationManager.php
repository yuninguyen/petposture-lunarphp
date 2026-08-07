<?php

namespace App\Filament\Resources\CustomerResource\RelationManagers;

use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;
use Lunar\Admin\Filament\Resources\CustomerResource\RelationManagers\UserRelationManager as BaseUserRelationManager;

class UserRelationManager extends BaseUserRelationManager
{
    public static function getTitle(Model $ownerRecord, string $pageClass): string
    {
        return __('Login Accounts');
    }

    public function getDefaultTable(Table $table): Table
    {
        return parent::getDefaultTable($table)->heading(__('Login Accounts'));
    }
}
