<?php

namespace App\Filament\Resources\OrderReturnRequestResource\Pages;

use App\Filament\Resources\OrderReturnRequestResource;
use App\Models\Setting;
use Filament\Actions\Action;
use Filament\Forms\Components\TextInput;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\ListRecords;

class ListOrderReturnRequests extends ListRecords
{
    protected static string $resource = OrderReturnRequestResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Action::make('returnSettings')
                ->label(__('Return Settings'))
                ->icon('heroicon-o-cog-6-tooth')
                ->color('gray')
                ->fillForm(fn () => [
                    'low_value_return_threshold' => Setting::get('low_value_return_threshold'),
                ])
                ->form([
                    TextInput::make('low_value_return_threshold')
                        ->label(__('Low-Value Auto-Waive Threshold'))
                        ->numeric()
                        ->prefix('$')
                        ->helperText('Return requests for items at or under this amount are flagged for the admin as eligible for an instant refund without requiring the item shipped back.'),
                ])
                ->action(function (array $data) {
                    Setting::updateOrCreate(
                        ['key' => 'low_value_return_threshold'],
                        ['value' => $data['low_value_return_threshold'], 'type' => 'int', 'group' => 'returns']
                    );

                    Notification::make()
                        ->title(__('Return settings saved'))
                        ->success()
                        ->send();
                }),
        ];
    }
}
