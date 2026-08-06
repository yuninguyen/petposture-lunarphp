<x-filament-panels::page>
    @php
        $user = $this->record;
    @endphp

    <style>
        .fi-header-heading { font-weight: 600 !important; }
    </style>

    <x-filament::section :heading="__('Profile')">
        <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
            <div style="width:56px;height:56px;border-radius:999px;background:#f3f4f6;border:1px solid #e5e7eb;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#6b7280;flex-shrink:0;">
                {{ $this->getInitials() }}
            </div>
            <div>
                <div style="font-size:18px;font-weight:700;color:#111827;">{{ $user->name }}</div>
                <div style="font-size:13px;color:#6b7280;margin-top:2px;">{{ $user->email }}</div>
                <div style="display:flex;gap:8px;margin-top:8px;">
                    <span style="background:#f3f4f6;color:#374151;border-radius:999px;padding:2px 10px;font-size:11px;font-weight:700;">{{ $this->getRoleLabel() }}</span>
                    @if ($user->is_active)
                        <span style="background:#dcfce7;color:#16a34a;border-radius:999px;padding:2px 10px;font-size:11px;font-weight:700;">{{ __('Active') }}</span>
                    @else
                        <span style="background:#fee2e2;color:#dc2626;border-radius:999px;padding:2px 10px;font-size:11px;font-weight:700;">{{ __('Inactive') }}</span>
                    @endif
                </div>
            </div>
        </div>
    </x-filament::section>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:24px;" class="fi-user-grid">
        <x-filament::section :heading="__('Account Details')">
            <dl style="display:flex;flex-direction:column;gap:16px;">
                <div style="display:flex;justify-content:space-between;">
                    <dt style="font-size:13px;color:#6b7280;">{{ __('User ID') }}</dt>
                    <dd style="font-size:13px;font-weight:600;font-family:monospace;">#{{ str_pad($user->id, 3, '0', STR_PAD_LEFT) }}</dd>
                </div>
                <div style="display:flex;justify-content:space-between;">
                    <dt style="font-size:13px;color:#6b7280;">{{ __('Role') }}</dt>
                    <dd style="font-size:13px;font-weight:600;">
                        <span style="background:#f3f4f6;color:#374151;border-radius:999px;padding:2px 10px;font-size:11px;font-weight:700;">{{ $this->getRoleLabel() }}</span>
                    </dd>
                </div>
                <div style="display:flex;justify-content:space-between;">
                    <dt style="font-size:13px;color:#6b7280;">{{ __('Status') }}</dt>
                    <dd>
                        @if ($user->is_active)
                            <span style="background:#dcfce7;color:#16a34a;border-radius:999px;padding:2px 10px;font-size:11px;font-weight:700;">{{ __('Active') }}</span>
                        @else
                            <span style="background:#fee2e2;color:#dc2626;border-radius:999px;padding:2px 10px;font-size:11px;font-weight:700;">{{ __('Inactive') }}</span>
                        @endif
                    </dd>
                </div>
            </dl>
        </x-filament::section>

        <x-filament::section :heading="__('Activity')">
            <dl style="display:flex;flex-direction:column;gap:16px;">
                <div style="display:flex;justify-content:space-between;">
                    <dt style="font-size:13px;color:#6b7280;">{{ __('Last Login') }}</dt>
                    <dd style="font-size:13px;font-weight:600;">{{ $user->last_login_at?->format('M j, Y') ?? __('Never') }}</dd>
                </div>
                <div style="display:flex;justify-content:space-between;">
                    <dt style="font-size:13px;color:#6b7280;">{{ __('Email') }}</dt>
                    <dd style="font-size:13px;font-weight:600;">{{ $user->email }}</dd>
                </div>
                <div style="display:flex;justify-content:space-between;">
                    <dt style="font-size:13px;color:#6b7280;">{{ __('Member Since') }}</dt>
                    <dd style="font-size:13px;font-weight:600;">{{ $user->created_at?->format('M j, Y') }}</dd>
                </div>
            </dl>
        </x-filament::section>
    </div>

    <style>
        @media (max-width: 900px) {
            .fi-user-grid { grid-template-columns: 1fr !important; }
        }
    </style>
</x-filament-panels::page>
