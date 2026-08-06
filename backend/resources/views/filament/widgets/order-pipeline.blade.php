<x-filament-widgets::widget>
    <x-filament::section>
        <x-slot name="heading">
            {{ $heading }}
        </x-slot>

        <div class="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-0">
            @foreach ($stages as $status => $stage)
                <div class="flex flex-1 items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3 dark:border-white/5 dark:bg-white/5 sm:rounded-none sm:border-0 sm:bg-transparent sm:px-3">
                    <div
                        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-sm"
                        style="background-color: {{ $stage['color'] }}1a; color: {{ $stage['color'] }};"
                    >
                        <x-filament::icon :icon="$stage['icon']" class="h-5 w-5" />
                    </div>
                    <div class="min-w-0">
                        <div class="text-2xl font-bold leading-none" style="color: {{ $stage['color'] }};">
                            {{ number_format($stage['count']) }}
                        </div>
                        <div class="mt-1 truncate text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            {{ $stage['label'] }}
                        </div>
                    </div>
                </div>

                @if (! $loop->last)
                    <div class="hidden shrink-0 items-center px-1 text-gray-300 dark:text-gray-600 sm:flex">
                        <x-filament::icon icon="heroicon-o-chevron-right" class="h-4 w-4" />
                    </div>
                @endif
            @endforeach
        </div>
    </x-filament::section>
</x-filament-widgets::widget>
