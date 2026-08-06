<x-filament-widgets::widget>
    <div class="flex h-full flex-col gap-6">
        <x-filament::section>
            <x-slot name="heading">
                {{ __('admin.dashboard.traffic_sources') }}
            </x-slot>

            <div class="flex items-center gap-6">
                <div class="relative flex h-32 w-32 shrink-0 items-center justify-center rounded-full" style="background: conic-gradient(#e5e7eb 0deg 360deg);">
                    <div class="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-white text-center dark:bg-gray-900">
                        <span class="text-base font-bold text-gray-400">—</span>
                        <span class="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{{ __('admin.dashboard.stats.not_connected') }}</span>
                    </div>
                </div>

                <ul class="flex-1 space-y-3">
                    @foreach ($trafficSources as $source)
                        <li class="flex items-center justify-between gap-2 text-sm">
                            <span class="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                <span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background-color: {{ $source['color'] }};"></span>
                                {{ $source['label'] }}
                            </span>
                            <span class="text-xs font-semibold text-gray-400">—</span>
                        </li>
                    @endforeach
                </ul>
            </div>
        </x-filament::section>

        <x-filament::section class="flex-1">
            <x-slot name="heading">
                {{ __('admin.dashboard.goals.heading', ['month' => now()->translatedFormat('F Y')]) }}
            </x-slot>

            <div class="space-y-6">
                @foreach ($goals as $goal)
                    <div>
                        <div class="mb-2.5 flex items-baseline justify-between gap-2">
                            <span class="text-sm font-bold text-gray-700 dark:text-gray-200">
                                {{ $goal['label'] }}
                            </span>
                            @if ($goal['percent'] !== null)
                                <span class="text-base font-bold text-[#df8448]">{{ $goal['percent'] }}%</span>
                            @endif
                        </div>

                        @if ($goal['percent'] !== null)
                            <div class="mb-2 h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                                <div class="h-full rounded-full bg-[#df8448] transition-all" style="width: {{ $goal['percent'] }}%"></div>
                            </div>
                            <div class="flex items-center justify-between text-xs">
                                @if ($goal['format'] === 'currency')
                                    <span class="font-semibold text-gray-600 dark:text-gray-300">${{ number_format($goal['actual']) }}</span>
                                    <span class="text-gray-400">{{ __('admin.dashboard.goals.target') }}: ${{ number_format($goal['target']) }}</span>
                                @else
                                    <span class="font-semibold text-gray-600 dark:text-gray-300">{{ number_format($goal['actual']) }}</span>
                                    <span class="text-gray-400">{{ __('admin.dashboard.goals.target') }}: {{ number_format($goal['target']) }}</span>
                                @endif
                            </div>
                        @else
                            <div class="mb-2 h-2.5 w-full rounded-full bg-gray-100 dark:bg-white/10"></div>
                            <div class="text-xs text-gray-400">{{ __('admin.dashboard.goals.no_target') }}</div>
                        @endif
                    </div>
                @endforeach
            </div>
        </x-filament::section>
    </div>
</x-filament-widgets::widget>
