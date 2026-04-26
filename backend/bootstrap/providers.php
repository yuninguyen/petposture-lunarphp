<?php

use App\Providers\AppServiceProvider;

return [
    AppServiceProvider::class,
    App\Providers\Filament\AdminPanelProvider::class,
    // Lunar\Admin\LunarPanelProvider::class, // disabled: Lunar resources merged into /admin panel
];
