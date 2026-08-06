<?php

namespace App\Filament\Resources\UserResource\Pages;

use App\Filament\Resources\UserResource;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Resources\Pages\ViewRecord;
use Illuminate\Support\Str;

class ViewUser extends ViewRecord
{
    protected static string $resource = UserResource::class;

    protected static string $view = 'filament.resources.user-resource.pages.view-user';

    public function getTitle(): string
    {
        return $this->record->name;
    }

    public function getInitials(): string
    {
        $name = trim((string) $this->record->name);

        if ($name === '') {
            return '?';
        }

        $words = preg_split('/\s+/', $name);

        return collect($words)->take(2)->map(fn ($word) => mb_strtoupper(mb_substr($word, 0, 1)))->implode('') ?: '?';
    }

    public function getRoleLabel(): string
    {
        $role = $this->record->getRoleNames()->first();

        return $role ? Str::headline($role) : '—';
    }

    protected function getHeaderActions(): array
    {
        return [
            EditAction::make()
                ->icon('heroicon-o-pencil-square')
                ->color('primary')
                ->outlined()
                ->extraAttributes(['style' => 'font-weight: 500;']),
            DeleteAction::make()
                ->icon('heroicon-o-trash')
                ->color('danger')
                ->outlined()
                ->extraAttributes(['style' => 'font-weight: 500;']),
        ];
    }
}
