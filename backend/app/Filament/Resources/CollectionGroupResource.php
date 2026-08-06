<?php

namespace App\Filament\Resources;

use App\Filament\Resources\CollectionGroupResource\Pages\EditCollectionGroup;
use Lunar\Admin\Filament\Resources\CollectionGroupResource as BaseCollectionGroupResource;

class CollectionGroupResource extends BaseCollectionGroupResource
{
    public static function getDefaultPages(): array
    {
        return array_merge(parent::getDefaultPages(), [
            'edit' => EditCollectionGroup::route('/{record}/edit'),
        ]);
    }
}
