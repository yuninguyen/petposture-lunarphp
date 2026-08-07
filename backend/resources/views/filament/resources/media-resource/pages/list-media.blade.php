<x-filament-panels::page>
    @php
        $stats = $this->getStorageStats();
        $folders = $this->getFolders();
        $files = $this->getFiles();
        $currentFolder = $folders->firstWhere('key', $activeCollection);

        $iconFor = function (string $mime) {
            return match (true) {
                str_starts_with($mime, 'image/') => ['bg' => '#dbeafe', 'fg' => '#2563eb'],
                str_starts_with($mime, 'video/') => ['bg' => '#ede9fe', 'fg' => '#7c3aed'],
                default => ['bg' => '#fee2e2', 'fg' => '#dc2626'],
            };
        };
    @endphp

    <div style="display:grid;grid-template-columns:240px 1fr;gap:24px;align-items:start;" class="fi-media-grid">
        <div style="display:flex;flex-direction:column;gap:16px;">
            <x-filament::section>
                <button
                    wire:click="setCollection('all')"
                    style="display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;border-radius:8px;font-size:13.5px;font-weight:600;text-align:left;background:{{ $activeCollection === 'all' ? '#fdf2eb' : 'transparent' }};color:{{ $activeCollection === 'all' ? '#c9713a' : '#374151' }};cursor:pointer;"
                >
                    <x-filament::icon icon="heroicon-o-folder-open" style="width:16px;height:16px;" />
                    <span>{{ __('All Files') }}</span>
                </button>
            </x-filament::section>

            <x-filament::section>
                <div style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:#111827;margin-bottom:8px;">
                    <x-filament::icon icon="heroicon-o-server-stack" style="width:16px;height:16px;color:#9ca3af;" />
                    {{ __('Storage') }}
                </div>
                <div style="font-size:22px;font-weight:700;color:#111827;">{{ $stats['used_human'] }}</div>
                @if ($stats['capacity_human'])
                    <div style="font-size:12px;color:#9ca3af;margin-top:2px;">{{ __('of') }} {{ $stats['capacity_human'] }} {{ __('free on disk') }}</div>
                    <div style="height:6px;background:#f1f3f6;border-radius:99px;margin-top:10px;overflow:hidden;">
                        <div style="height:100%;background:#df8448;width:{{ min(100, $stats['percent']) }}%;"></div>
                    </div>
                @else
                    <div style="font-size:12px;color:#9ca3af;margin-top:2px;">{{ $stats['count'] }} {{ __('files') }}</div>
                @endif
            </x-filament::section>
        </div>

        <x-filament::section>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;flex-wrap:wrap;">
                <input
                    type="text"
                    wire:model.live.debounce.400ms="search"
                    placeholder="{{ __('Search files...') }}"
                    style="border:1px solid #e5e7eb;border-radius:999px;padding:8px 16px;font-size:13px;width:260px;max-width:100%;"
                />

                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                    <div style="display:flex;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                        <button
                            wire:click="setViewMode('grid')"
                            style="padding:7px 9px;background:{{ $view_mode === 'grid' ? '#f3f4f6' : '#fff' }};line-height:0;cursor:pointer;"
                        >
                            <x-filament::icon icon="heroicon-o-squares-2x2" style="width:16px;height:16px;color:#374151;" />
                        </button>
                        <button
                            wire:click="setViewMode('list')"
                            style="padding:7px 9px;background:{{ $view_mode === 'list' ? '#f3f4f6' : '#fff' }};border-left:1px solid #e5e7eb;line-height:0;cursor:pointer;"
                        >
                            <x-filament::icon icon="heroicon-o-bars-3" style="width:16px;height:16px;color:#374151;" />
                        </button>
                    </div>

                    <button
                        x-data=""
                        x-on:click="const n = prompt('{{ __('Folder Name') }}'); if (n && n.trim()) $wire.createFolder(n)"
                        style="display:inline-flex;align-items:center;gap:6px;background:#fff;color:#374151;font-size:13px;font-weight:600;padding:8px 14px;border-radius:8px;border:1px solid #e5e7eb;cursor:pointer;"
                    >
                        <x-filament::icon icon="heroicon-o-folder-plus" style="width:15px;height:15px;" />
                        {{ __('New Folder') }}
                    </button>

                    <a
                        href="{{ $this->uploadUrl() }}"
                        style="display:inline-flex;align-items:center;gap:6px;background:#16a34a;color:#fff;font-size:13px;font-weight:600;padding:8px 14px;border-radius:8px;text-decoration:none;"
                    >
                        <x-filament::icon icon="heroicon-o-arrow-up-tray" style="width:15px;height:15px;" />
                        {{ __('Upload') }}
                    </a>
                </div>
            </div>

            <div style="display:flex;align-items:center;gap:6px;font-size:13px;color:#6b7280;margin-bottom:16px;">
                <x-filament::icon icon="heroicon-o-home" style="width:14px;height:14px;" />
                <button wire:click="setCollection('all')" style="color:{{ $activeCollection === 'all' ? '#111827' : '#6b7280' }};font-weight:{{ $activeCollection === 'all' ? '700' : '500' }};cursor:pointer;">
                    {{ __('Files') }}
                </button>
                @if ($currentFolder)
                    <span>/</span>
                    <span style="color:#111827;font-weight:700;">{{ $currentFolder['label'] }}</span>
                @endif
            </div>

            @if ($folders->isEmpty() && $files->isEmpty())
                <p style="text-align:center;color:#9ca3af;padding:32px 0;font-size:13px;">{{ __('No files found.') }}</p>
            @elseif ($view_mode === 'list')
                <div style="display:flex;flex-direction:column;">
                    @if ($activeCollection === 'all')
                        @foreach ($folders as $folder)
                            <div style="display:flex;align-items:center;gap:12px;padding:10px 8px;border-bottom:1px solid #f1f3f6;">
                                <button wire:click="setCollection('{{ $folder['key'] }}')" style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;cursor:pointer;text-align:left;">
                                    <span style="width:36px;height:36px;border-radius:10px;background:#e7f6ee;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                                        <x-filament::icon icon="heroicon-o-folder" style="width:18px;height:18px;color:#16a34a;" />
                                    </span>
                                    <span style="font-size:13px;font-weight:600;color:#111827;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ $folder['label'] }}</span>
                                </button>
                                <span style="font-size:12px;color:#9ca3af;flex-shrink:0;">{{ trans_choice('{1} 1 file|[2,*] :count files', $folder['count'], ['count' => $folder['count']]) }}</span>
                                @if ($folder['is_custom'])
                                    <div style="display:flex;gap:4px;flex-shrink:0;">
                                        <button
                                            x-data=""
                                            x-on:click="const n = prompt('{{ __('Rename folder') }}', '{{ $folder['label'] }}'); if (n) $wire.renameFolder({{ $folder['id'] }}, n)"
                                            style="font-size:11px;font-weight:700;color:#374151;cursor:pointer;padding:4px 6px;"
                                        >{{ __('Rename') }}</button>
                                        <button wire:click="downloadFolder('{{ $folder['key'] }}')" style="font-size:11px;font-weight:700;color:#374151;cursor:pointer;padding:4px 6px;">{{ __('Download') }}</button>
                                        <button
                                            x-data=""
                                            x-on:click="navigator.clipboard.writeText('{{ $this->folderShareUrl($folder['key']) }}'); $tooltip('{{ __('Link copied!') }}', { timeout: 1500 })"
                                            style="font-size:11px;font-weight:700;color:#374151;cursor:pointer;padding:4px 6px;"
                                        >{{ __('Share') }}</button>
                                        <button wire:click="deleteFolder({{ $folder['id'] }})" wire:confirm="{{ __('Delete this folder?') }}" style="font-size:11px;font-weight:700;color:#dc2626;cursor:pointer;padding:4px 6px;">{{ __('Delete') }}</button>
                                    </div>
                                @endif
                            </div>
                        @endforeach
                    @endif

                    @foreach ($files as $file)
                        @php $palette = $iconFor($file->mime_type ?? ''); @endphp
                        <div style="display:flex;align-items:center;gap:12px;padding:10px 8px;border-bottom:1px solid #f1f3f6;">
                            <span style="width:36px;height:36px;border-radius:10px;background:{{ $palette['bg'] }};color:{{ $palette['fg'] }};display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;">
                                @if (str_starts_with($file->mime_type ?? '', 'image/'))
                                    <img src="{{ $file->getUrl() }}" alt="{{ $file->name }}" style="width:100%;height:100%;object-fit:cover;" />
                                @else
                                    <x-filament::icon icon="heroicon-o-document" style="width:16px;height:16px;" />
                                @endif
                            </span>
                            <span style="flex:1;min-width:0;font-size:13px;font-weight:600;color:#111827;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="{{ $file->file_name }}">{{ $file->file_name }}</span>
                            <span style="font-size:12px;color:#9ca3af;flex-shrink:0;width:70px;">{{ $file->human_readable_size }}</span>
                            <span style="font-size:12px;color:#9ca3af;flex-shrink:0;width:60px;">{{ $file->created_at->format('M j') }}</span>
                            <div style="display:flex;gap:4px;flex-shrink:0;">
                                <button
                                    x-data=""
                                    x-on:click="navigator.clipboard.writeText('{{ $file->getUrl() }}'); $tooltip('Copied!', { timeout: 1500 })"
                                    style="font-size:11px;font-weight:700;color:#374151;cursor:pointer;padding:4px 6px;"
                                >{{ __('Copy URL') }}</button>
                                <button
                                    wire:click="deleteMedia({{ $file->id }})"
                                    wire:confirm="{{ __('Delete this file?') }}"
                                    style="font-size:11px;font-weight:700;color:#dc2626;cursor:pointer;padding:4px 6px;"
                                >{{ __('Delete') }}</button>
                            </div>
                        </div>
                    @endforeach
                </div>
            @else
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;">
                    @if ($activeCollection === 'all')
                        @foreach ($folders as $folder)
                            <div
                                x-data="{ menuOpen: false }"
                                style="position:relative;border:1px solid #eaecf0;border-radius:12px;padding:16px 14px;background:#fff;"
                            >
                                @if ($folder['is_custom'])
                                    <button
                                        x-on:click="menuOpen = !menuOpen"
                                        x-on:click.outside="menuOpen = false"
                                        style="position:absolute;top:8px;right:8px;padding:4px;border-radius:6px;line-height:0;cursor:pointer;"
                                    >
                                        <x-filament::icon icon="heroicon-o-ellipsis-vertical" style="width:16px;height:16px;color:#9ca3af;" />
                                    </button>

                                    <div
                                        x-show="menuOpen"
                                        x-cloak
                                        style="position:absolute;top:34px;right:8px;z-index:20;background:#fff;border:1px solid #eaecf0;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.08);min-width:150px;padding:6px;"
                                    >
                                        <button
                                            x-on:click="menuOpen = false; const n = prompt('{{ __('Rename folder') }}', '{{ $folder['label'] }}'); if (n) $wire.renameFolder({{ $folder['id'] }}, n)"
                                            style="display:flex;align-items:center;gap:8px;width:100%;padding:7px 10px;border-radius:6px;font-size:12.5px;font-weight:600;color:#374151;text-align:left;cursor:pointer;"
                                        >
                                            <x-filament::icon icon="heroicon-o-pencil-square" style="width:15px;height:15px;" />
                                            {{ __('Rename') }}
                                        </button>
                                        <button
                                            wire:click="downloadFolder('{{ $folder['key'] }}')"
                                            x-on:click="menuOpen = false"
                                            style="display:flex;align-items:center;gap:8px;width:100%;padding:7px 10px;border-radius:6px;font-size:12.5px;font-weight:600;color:#374151;text-align:left;cursor:pointer;"
                                        >
                                            <x-filament::icon icon="heroicon-o-arrow-down-tray" style="width:15px;height:15px;" />
                                            {{ __('Download') }}
                                        </button>
                                        <button
                                            x-on:click="menuOpen = false; navigator.clipboard.writeText('{{ $this->folderShareUrl($folder['key']) }}'); $tooltip('{{ __('Link copied!') }}', { timeout: 1500 })"
                                            style="display:flex;align-items:center;gap:8px;width:100%;padding:7px 10px;border-radius:6px;font-size:12.5px;font-weight:600;color:#374151;text-align:left;cursor:pointer;"
                                        >
                                            <x-filament::icon icon="heroicon-o-share" style="width:15px;height:15px;" />
                                            {{ __('Share') }}
                                        </button>
                                        <button
                                            wire:click="deleteFolder({{ $folder['id'] }})"
                                            wire:confirm="{{ __('Delete this folder?') }}"
                                            x-on:click="menuOpen = false"
                                            style="display:flex;align-items:center;gap:8px;width:100%;padding:7px 10px;border-radius:6px;font-size:12.5px;font-weight:600;color:#dc2626;text-align:left;cursor:pointer;"
                                        >
                                            <x-filament::icon icon="heroicon-o-trash" style="width:15px;height:15px;" />
                                            {{ __('Delete') }}
                                        </button>
                                    </div>
                                @endif

                                <button wire:click="setCollection('{{ $folder['key'] }}')" style="display:flex;flex-direction:column;align-items:center;width:100%;cursor:pointer;">
                                    <span style="width:56px;height:56px;border-radius:14px;background:#e7f6ee;display:flex;align-items:center;justify-content:center;margin-bottom:10px;">
                                        <x-filament::icon icon="heroicon-o-folder" style="width:26px;height:26px;color:#16a34a;" />
                                    </span>
                                    <span style="font-size:13px;font-weight:700;color:#111827;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;">{{ $folder['label'] }}</span>
                                    <span style="font-size:11px;color:#9ca3af;margin-top:2px;">{{ trans_choice('{1} 1 file|[2,*] :count files', $folder['count'], ['count' => $folder['count']]) }}</span>
                                </button>
                            </div>
                        @endforeach
                    @endif

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
