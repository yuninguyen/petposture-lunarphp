<?php

namespace App\Filament\Pages;

use App\Models\Setting;
use Filament\Forms\Components\Grid;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Pages\Page;

class Goals extends Page
{
    protected static ?string $navigationIcon = 'heroicon-o-flag';

    protected static string $view = 'filament.pages.goals';

    protected static ?int $navigationSort = 1;

    public static function getNavigationGroup(): ?string
    {
        return __('Finance');
    }

    public function getTitle(): string
    {
        return __('Goals');
    }

    public ?array $data = [];

    public function mount(): void
    {
        $data = [];
        foreach (Setting::all() as $setting) {
            $data[$setting->key] = $setting->value;
        }

        $this->form->fill($data);
    }

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                Grid::make(3)->schema([
                    TextInput::make('monthly_revenue_target')
                        ->label(__('Monthly Revenue Target'))
                        ->numeric()
                        ->prefix('$')
                        ->helperText(__('Shown as a progress bar on the dashboard.')),
                    TextInput::make('monthly_orders_target')
                        ->label(__('Monthly Orders Target'))
                        ->numeric(),
                    TextInput::make('monthly_new_customers_target')
                        ->label(__('Monthly New Customers Target'))
                        ->numeric(),
                ]),
            ])
            ->statePath('data');
    }

    public function save(): void
    {
        $data = $this->form->getState();

        foreach ($data as $key => $value) {
            if ($value === null || $value === '') {
                continue;
            }

            Setting::updateOrCreate(
                ['key' => $key],
                [
                    'value' => $value,
                    'type' => is_numeric($value) ? 'int' : 'string',
                    'group' => 'goals',
                ]
            );
        }

        Notification::make()
            ->title(__('Goals saved successfully!'))
            ->success()
            ->send();
    }
}
