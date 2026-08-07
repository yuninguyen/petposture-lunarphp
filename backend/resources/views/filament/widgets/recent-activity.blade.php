<x-filament-widgets::widget>
    <x-filament::section>
        <x-slot name="heading">
            {{ __('admin.dashboard.recent_activity') }}
        </x-slot>

        @if ($events->isEmpty())
            <p class="text-sm text-gray-400">{{ __('admin.dashboard.no_orders_yet') }}</p>
        @else
            <div class="space-y-5">
                @foreach ($events as $event)
                    <div class="flex items-start gap-3">
                        <div
                            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                            style="background-color: {{ $event['color'] }}1a; color: {{ $event['color'] }};"
                        >
                            <x-filament::icon :icon="$event['icon']" class="h-4 w-4" />
                        </div>
                        <div class="min-w-0 flex-1">
                            <p class="fi-recent-activity-text text-gray-950 dark:text-white">{{ $event['title'] }}</p>
                            <p class="fi-recent-activity-text truncate text-gray-500 dark:text-gray-400">{{ $event['description'] }}</p>
                            <p class="fi-recent-activity-text mt-0.5 text-gray-400">{{ $event['at']->diffForHumans() }}</p>
                        </div>
                    </div>
                @endforeach
            </div>
        @endif
    </x-filament::section>
</x-filament-widgets::widget>
