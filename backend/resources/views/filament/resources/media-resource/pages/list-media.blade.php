<x-filament-panels::page>
    @php
        $stats = $this->getStorageStats();
        $folders = $this->getFolders();
        $files = $this->getFiles();

        $iconFor = function (string $mime) {
            return match (true) {
                str_starts_with($mime, 'image/') => ['bg' => '#dbeafe', 'fg' => '#2563eb'],
                str_starts_with($mime, 'video/') => ['bg' => '#ede9fe', 'fg' => '#7c3aed'],
                default => ['bg' => '#fee2e2', 'fg' => '#dc2626'],
            };
        };
    @endphp

    <div style="display:grid;grid-template-columns:260px 1fr;gap:24px;align-items:start;" class="fi-media-grid">
        <div style="display:flex;flex-direction:column;gap:20px;">
            <x-filament::section>
                <div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:8px;">{{ __('Storage') }}</div>
                <div style="font-size:24px;font-weight:700;color:#111827;">{{ $stats['used_human'] }}</div>
                @if ($stats['capacity_human'])
                    <div style="font-size:12px;color:#9ca3af;margin-top:2px;">{{ __('of') }} {{ $stats['capacity_human'] }} {{ __('free on disk') }}</div>
                    <div style="height:6px;background:#f1f3f6;border-radius:99px;margin-top:10px;overflow:hidden;">
                        <div style="height:100%;background:#df8448;width:{{ min(100, $stats['percent']) }}%;"></div>
                    </div>
                @else
                    <div style="font-size:12px;color:#9ca3af;margin-top:2px;">{{ $stats['count'] }} {{ __('files') }}</div>
                @endif
            </x-filament::section>

            <x-filament::section>
                <div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:10px;">{{ __('Folders') }}</div>
                <div style="display:flex;flex-direction:column;gap:2px;">
                    <button
                        wire:click="setCollection('all')"
                        style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:8px;font-size:13px;font-weight:600;text-align:left;background:{{ $activeCollection === 'all' ? '#fdf2eb' : 'transparent' }};color:{{ $activeCollection === 'all' ? '#c9713a' : '#374151' }};cursor:pointer;"
                    >
                        <span>{{ __('All Files') }}</span>
                        <span style="color:#9ca3af;font-weight:700;">{{ $stats['count'] }}</span>
                    </button>
                    @foreach ($folders as $folder)
                        <button
                            wire:click="setCollection('{{ $folder['key'] }}')"
                            style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:8px;font-size:13px;font-weight:600;text-align:left;background:{{ $activeCollection === $folder['key'] ? '#fdf2eb' : 'transparent' }};color:{{ $activeCollection === $folder['key'] ? '#c9713a' : '#374151' }};cursor:pointer;"
                        >
                            <span>{{ $folder['label'] }}</span>
                            <span style="color:#9ca3af;font-weight:700;">{{ $folder['count'] }}</span>
                        </button>
                    @endforeach
                </div>
            </x-filament::section>
        </div>

        <x-filament::section>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px;flex-wrap:wrap;">
                <div style="font-size:13px;font-weight:700;color:#111827;">{{ __('Files') }}</div>
                <input
                    type="text"
                    wire:model.live.debounce.400ms="search"
                    placeholder="{{ __('Search files...') }}"
                    style="border:1px solid #e5e7eb;border-radius:8px;padding:6px 12px;font-size:13px;width:220px;"
                />
            </div>

            @if ($files->isEmpty())
                <p style="text-align:center;color:#9ca3af;padding:32px 0;font-size:13px;">{{ __('No files found.') }}</p>
            @else
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;">
                    @foreach ($files as $file)
                        @php $palette = $iconFor($file->mime_type ?? ''); @endphp
                        <div style="border:1px solid #eaecf0;border-radius:12px;overflow:hidden;background:#fff;">
                            <div style="height:110px;background:#f8fafc;display:flex;align-items:center;justify-content:center;overflow:hidden;">
                                @if (str_starts_with($file->mime_type ?? '', 'image/'))
                                    <img src="{{ $file->getUrl() }}" alt="{{ $file->name }}" style="width:100%;height:100%;object-fit:cover;" />
                                @else
                                    <span style="width:40px;height:40px;border-radius:10px;background:{{ $palette['bg'] }};color:{{ $palette['fg'] }};display:flex;align-items:center;justify-content:center;">
                                        <x-filament::icon icon="heroicon-o-document" style="width:20px;height:20px;" />
                                    </span>
                                @endif
                            </div>
                            <div style="padding:10px 12px;">
                                <div style="font-size:12.5px;font-weight:600;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="{{ $file->file_name }}">{{ $file->file_name }}</div>
                                <div style="display:flex;justify-content:space-between;margin-top:3px;font-size:11px;color:#9ca3af;">
                                    <span>{{ $file->human_readable_size }}</span>
                                    <span>{{ $file->created_at->format('M j') }}</span>
                                </div>
                                <div style="display:flex;gap:8px;margin-top:8px;">
                                    <button
                                        x-data=""
                                        x-on:click="navigator.clipboard.writeText('{{ $file->getUrl() }}'); $tooltip('Copied!', { timeout: 1500 })"
                                        style="font-size:11px;font-weight:700;color:#374151;cursor:pointer;"
                                    >
                                        {{ __('Copy URL') }}
                                    </button>
                                    <button
                                        wire:click="deleteMedia({{ $file->id }})"
                                        wire:confirm="{{ __('Delete this file?') }}"
                                        style="font-size:11px;font-weight:700;color:#dc2626;cursor:pointer;"
                                    >
                                        {{ __('Delete') }}
                                    </button>
                                </div>
                            </div>
                        </div>
                    @endforeach
                </div>
            @endif
        </x-filament::section>
    </div>

    <style>
        @media (max-width: 900px) {
            .fi-media-grid { grid-template-columns: 1fr !important; }
        }
    </style>
</x-filament-panels::page>
