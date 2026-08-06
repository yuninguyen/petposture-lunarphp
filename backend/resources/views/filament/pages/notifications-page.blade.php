<x-filament-panels::page>
    @php
        $colors = [
            'success' => ['bg' => '#dcfce7', 'fg' => '#16a34a'],
            'warning' => ['bg' => '#fef3c7', 'fg' => '#d97706'],
            'info' => ['bg' => '#dbeafe', 'fg' => '#2563eb'],
            'danger' => ['bg' => '#fee2e2', 'fg' => '#dc2626'],
        ];
        $grouped = $this->getGroupedNotifications();
    @endphp

    <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
        <button
            wire:click="setTab('all')"
            style="border-radius:999px;padding:6px 16px;font-size:13px;font-weight:700;border:1px solid {{ $activeTab === 'all' ? '#df8448' : '#e5e7eb' }};background:{{ $activeTab === 'all' ? '#df8448' : '#fff' }};color:{{ $activeTab === 'all' ? '#fff' : '#374151' }};cursor:pointer;"
        >
            {{ __('All') }}
        </button>
        <button
            wire:click="setTab('unread')"
            style="border-radius:999px;padding:6px 16px;font-size:13px;font-weight:700;border:1px solid {{ $activeTab === 'unread' ? '#df8448' : '#e5e7eb' }};background:{{ $activeTab === 'unread' ? '#df8448' : '#fff' }};color:{{ $activeTab === 'unread' ? '#fff' : '#374151' }};cursor:pointer;"
        >
            {{ __('Unread') }} ({{ $this->getUnreadCount() }})
        </button>
    </div>

    @if ($grouped->isEmpty())
        <x-filament::section>
            <p style="text-align:center;color:#9ca3af;padding:24px 0;">{{ __('No notifications yet.') }}</p>
        </x-filament::section>
    @else
        @foreach ($grouped as $day => $items)
            <div style="margin-bottom:22px;">
                <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#9ca3af;margin-bottom:10px;">{{ $day }}</div>

                <div style="display:flex;flex-direction:column;gap:10px;">
                    @foreach ($items as $notification)
                        @php
                            $data = $notification->data;
                            $palette = $colors[$data['color'] ?? 'info'] ?? $colors['info'];
                        @endphp
                        <a
                            href="{{ $data['url'] ?? '#' }}"
                            style="display:flex;align-items:start;gap:14px;background:#fff;border:1px solid #eaecf0;border-radius:12px;padding:14px 16px;text-decoration:none;"
                        >
                            <span style="width:36px;height:36px;border-radius:999px;background:{{ $palette['bg'] }};color:{{ $palette['fg'] }};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                                <x-filament::icon :icon="$data['icon'] ?? 'heroicon-o-bell'" style="width:18px;height:18px;" />
                            </span>

                            <span style="flex:1;min-width:0;">
                                <span style="display:block;font-weight:700;color:#111827;font-size:14px;">{{ $data['title'] ?? 'Notification' }}</span>
                                <span style="display:block;color:#6b7280;font-size:13px;margin-top:2px;">{{ $data['body'] ?? '' }}</span>
                            </span>

                            <span style="display:flex;align-items:center;gap:6px;flex-shrink:0;white-space:nowrap;font-size:12px;color:#9ca3af;">
                                {{ $notification->created_at->diffForHumans() }}
                                @if (! $notification->read_at)
                                    <span style="width:7px;height:7px;border-radius:999px;background:#df8448;"></span>
                                @endif
                            </span>
                        </a>
                    @endforeach
                </div>
            </div>
        @endforeach
    @endif
</x-filament-panels::page>
