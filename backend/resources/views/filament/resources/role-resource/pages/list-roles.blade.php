<x-filament-panels::page>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:20px;">
        @foreach ($this->getRoles() as $role)
            <div style="background:#fff;border:1px solid #eaecf0;border-radius:14px;padding:20px;display:flex;flex-direction:column;gap:12px;">
                <div style="display:flex;align-items:start;justify-content:space-between;gap:8px;">
                    <div>
                        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                            <span style="font-size:16px;font-weight:700;color:#111827;">{{ str($role->name)->headline() }}</span>
                            <span style="background:#f3f4f6;color:#4b5563;border-radius:6px;padding:2px 8px;font-size:11px;font-weight:600;">{{ $role->guard_name }}</span>
                        </div>
                    </div>

                    <a
                        href="{{ \App\Filament\Resources\RoleResource\Pages\EditRole::getUrl(['record' => $role]) }}"
                        style="color:#9ca3af;flex-shrink:0;"
                        title="{{ __('Edit') }}"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </a>
                </div>

                <div style="display:flex;gap:20px;font-size:13px;color:#6b7280;margin-top:auto;">
                    <span style="display:flex;align-items:center;gap:5px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 12 2 2 4-4"/><path d="M12 3c-1.2 0-2.4.6-3 1.7A3.6 3.6 0 0 0 4.6 9c-1 .6-1.7 1.8-1.7 3s.7 2.4 1.7 3c-.3 1.2 0 2.5 1 3.4.9.9 2.2 1.3 3.4 1 .6 1 1.8 1.7 3 1.7s2.4-.7 3-1.7c1.2.3 2.5 0 3.4-1 .9-.9 1.3-2.2 1-3.4 1-.6 1.7-1.8 1.7-3s-.7-2.4-1.7-3c.3-1.2 0-2.5-1-3.4-.9-.9-2.2-1.3-3.4-1-.6-1-1.8-1.7-3-1.7Z"/></svg>
                        {{ $role->permissions_count }} {{ __('permissions') }}
                    </span>
                    <span style="display:flex;align-items:center;gap:5px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        {{ $role->users_count }} {{ __('users') }}
                    </span>
                </div>

                <a
                    href="{{ \App\Filament\Resources\RoleResource\Pages\ViewRole::getUrl(['record' => $role]) }}"
                    style="color:#df8448;font-size:13px;font-weight:600;text-decoration:none;"
                >
                    {{ __('View') }} →
                </a>
            </div>
        @endforeach
    </div>
</x-filament-panels::page>
