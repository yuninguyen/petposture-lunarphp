<x-filament-panels::page>
    <form wire:submit="save">
        {{ $this->form }}

        <div class="mt-6 flex items-center gap-3">
            <x-filament::button type="submit">
                Save Settings
            </x-filament::button>

            <x-filament::button color="gray" tag="a" :href="App\Filament\Pages\ManageSettings::getUrl()">
                Cancel
            </x-filament::button>
        </div>
    </form>
</x-filament-panels::page>