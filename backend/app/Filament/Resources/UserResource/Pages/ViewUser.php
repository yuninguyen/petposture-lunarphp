<?php

namespace App\Filament\Resources\UserResource\Pages;

use App\Filament\Resources\UserResource;
use App\Models\User;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Resources\Pages\ViewRecord;
use Illuminate\Support\Str;

class ViewUser extends ViewRecord
{
    protected static string $resource = UserResource::class;

    protected static string $view = 'filament.resources.user-resource.pages.view-user';

    private function user(): User
    {
        /** @var User $record */
        $record = $this->record;

        return $record;
    }

    public function getTitle(): string
    {
        return $this->user()->name;
    }

    public function getInitials(): string
    {
        $name = trim($this->user()->name);

        if ($name === '') {
            return '?';
        }

        $words = preg_split('/\s+/', $name);

        return collect($words)->take(2)->map(fn ($word) => mb_strtoupper(mb_substr($word, 0, 1)))->implode('') ?: '?';
    }

    public function getRoleLabel(): string
    {
        $role = $this->user()->getRoleNames()->first();

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
