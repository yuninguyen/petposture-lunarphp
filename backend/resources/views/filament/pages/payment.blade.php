<x-filament-panels::page>
    <form wire:submit="save">
        {{ $this->form }}

        <div class="mt-6 flex items-center gap-3">
            <x-filament::button type="submit">
                {{ __('Save Payment Settings') }}
            </x-filament::button>
        </div>
    </form>
</x-filament-panels::page>
