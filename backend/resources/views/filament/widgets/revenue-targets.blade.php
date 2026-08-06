<x-filament-widgets::widget>
    <x-filament::section>
        <x-slot name="heading">
            {{ $heading }}
        </x-slot>

        <div class="grid grid-cols-1 gap-6 sm:grid-cols-3">
            @foreach ($goals as $goal)
                <div>
                    <div class="mb-2 flex items-baseline justify-between gap-2">
                        <span class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            {{ $goal['label'] }}
                        </span>
                        @if ($goal['percent'] !== null)
                            <span class="text-xs font-bold text-[#df8448]">{{ $goal['percent'] }}%</span>
                        @endif
                    </div>

                    @if ($goal['percent'] !== null)
                        <div class="mb-1.5 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                            <div
                                class="h-full rounded-full bg-[#df8448] transition-all"
                                style="width: {{ $goal['percent'] }}%"
                            ></div>
                        </div>
                        <div class="text-sm font-bold text-gray-950 dark:text-white">
                            @if ($goal['format'] === 'currency')
                                ${{ number_format($goal['actual']) }} <span class="font-normal text-gray-400">/ ${{ number_format($goal['target']) }}</span>
                            @else
                                {{ number_format($goal['actual']) }} <span class="font-normal text-gray-400">/ {{ number_format($goal['target']) }}</span>
                            @endif
                        </div>
                    @else
                        <div class="mb-1.5 h-2 w-full rounded-full bg-gray-100 dark:bg-white/10"></div>
                        <div class="text-xs text-gray-400">
                            {{ __('admin.dashboard.goals.no_target') }}
                        </div>
                    @endif
                </div>
            @endforeach
        </div>
    </x-filament::section>
</x-filament-widgets::widget>
