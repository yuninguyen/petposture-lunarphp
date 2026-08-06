<x-filament-panels::page>
    @php
        $user = auth()->user();
        $roles = $user->getRoleNames();
    @endphp

    <div style="background:linear-gradient(120deg,#df8448,#c9713a);border-radius:14px;padding:28px 28px 24px;color:#fff;display:flex;align-items:center;gap:20px;flex-wrap:wrap;">
        <div style="width:72px;height:72px;border-radius:999px;background:rgba(255,255,255,.18);border:2px solid rgba(255,255,255,.4);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;flex-shrink:0;">
            {{ $this->getInitials() }}
        </div>

        <div style="flex:1;min-width:200px;">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                <span style="font-size:22px;font-weight:700;">{{ $user->name }}</span>
                @if ($roles->isNotEmpty())
                    <span style="background:rgba(255,255,255,.2);border-radius:999px;padding:2px 10px;font-size:11px;font-weight:700;letter-spacing:.03em;">{{ $this->getRoleLabel() }}</span>
                @endif
            </div>
            <div style="display:flex;gap:18px;margin-top:8px;font-size:13px;color:rgba(255,255,255,.9);flex-wrap:wrap;">
                <span>{{ $user->email }}</span>
                <span>{{ __('Joined') }} {{ $user->created_at?->format('F Y') }}</span>
            </div>
        </div>

        <x-filament::button
            tag="a"
            :href="\Filament\Pages\Auth\EditProfile::getUrl()"
            color="gray"
            icon="heroicon-o-pencil-square"
        >
            {{ __('Edit Profile') }}
        </x-filament::button>
    </div>

    <div style="display:grid;grid-template-columns:2fr 1fr;gap:24px;margin-top:24px;" class="fi-profile-grid">
        <x-filament::section :heading="__('Account Details')">
            <dl style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
                <div>
                    <dt style="font-size:11px;font-weight:500;text-transform:uppercase;color:#9ca3af;">{{ __('Name') }}</dt>
                    <dd style="margin-top:4px;font-weight:600;">{{ $user->name }}</dd>
                </div>
                <div>
                    <dt style="font-size:11px;font-weight:500;text-transform:uppercase;color:#9ca3af;">{{ __('Email') }}</dt>
                    <dd style="margin-top:4px;font-weight:600;">{{ $user->email }}</dd>
                </div>
                <div>
                    <dt style="font-size:11px;font-weight:500;text-transform:uppercase;color:#9ca3af;">{{ __('Role') }}</dt>
                    <dd style="margin-top:4px;font-weight:600;">{{ $this->getRoleLabel() }}</dd>
                </div>
                <div>
                    <dt style="font-size:11px;font-weight:500;text-transform:uppercase;color:#9ca3af;">{{ __('Member Since') }}</dt>
                    <dd style="margin-top:4px;font-weight:600;">{{ $user->created_at?->format('M j, Y') }}</dd>
                </div>
            </dl>
        </x-filament::section>

        <x-filament::section :heading="__('Recent Activity')">
            @php $activity = $this->getRecentActivity(); @endphp

            @if ($activity->isEmpty())
                <p style="color:#9ca3af;font-size:13px;">{{ __('No recent activity yet.') }}</p>
            @else
                <ul style="display:flex;flex-direction:column;gap:14px;">
                    @foreach ($activity as $entry)
                        <li style="display:flex;justify-content:space-between;gap:8px;font-size:13px;">
                            <span style="color:#374151;">{{ str(class_basename($entry->subject_type).' '.$entry->description)->headline() }}</span>
                            <span style="color:#9ca3af;white-space:nowrap;">{{ $entry->created_at->diffForHumans() }}</span>
                        </li>
                    @endforeach
                </ul>
            @endif
        </x-filament::section>
    </div>

    <style>
        @media (max-width: 900px) {
            .fi-profile-grid { grid-template-columns: 1fr !important; }
        }
    </style>
</x-filament-panels::page>
