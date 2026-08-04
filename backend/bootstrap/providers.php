<?php

use App\Providers\AppServiceProvider;
use App\Providers\Filament\AdminPanelProvider;

return [
    AppServiceProvider::class,
    AdminPanelProvider::class,
    // Lunar\Admin\LunarPanelProvider::class, // disabled: Lunar resources merged into /admin panel
];
