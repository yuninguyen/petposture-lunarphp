<?php

namespace App\Filament\Resources\CollectionGroupResource\Pages;

use App\Filament\Resources\CollectionGroupResource;
use Filament\Actions;
use Filament\Notifications\Notification;
use Lunar\Admin\Filament\Resources\CollectionGroupResource\Pages\EditCollectionGroup as BaseEditCollectionGroup;

class EditCollectionGroup extends BaseEditCollectionGroup
{
    protected static string $resource = CollectionGroupResource::class;

    protected function getDefaultHeaderActions(): array
    {
        return [
            Actions\DeleteAction::make()
                ->icon('heroicon-o-trash')
                ->color('danger')
                ->outlined()
                ->extraAttributes(['style' => 'font-weight: 500;'])
                ->before(function ($record, Actions\DeleteAction $action) {
                    if ($record->collections->count() > 0) {
                        Notification::make()
                            ->warning()
                            ->body(__('lunarpanel::collectiongroup.action.delete.notification.error_protected'))
                            ->send();
                        $action->cancel();
                    }
                }),
        ];
    }
}
