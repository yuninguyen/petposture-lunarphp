<x-filament-panels::page>
    @php
        $matrix = $this->getMatrix();
        $roles = $matrix['roles'];
        $groups = $matrix['groups'];
    @endphp

    <x-filament::section>
        <x-slot name="heading">{{ __('Role x Permission') }}</x-slot>
        <x-slot name="description">{{ __('Every permission the panel recognises, and which roles currently grant it.') }}</x-slot>

        <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead>
                    <tr style="border-bottom:1px solid #eaecf0;">
                        <th style="text-align:left;padding:10px 12px;font-weight:700;color:#6b7280;white-space:nowrap;">{{ __('Permission') }}</th>
                        @foreach ($roles as $role)
                            <th style="text-align:center;padding:10px 12px;white-space:nowrap;">
                                <span style="background:#fdf2eb;color:#c9713a;border-radius:999px;padding:3px 10px;font-size:11px;font-weight:700;">{{ $role->name }}</span>
                            </th>
                        @endforeach
                    </tr>
                </thead>
                <tbody>
                    @foreach ($groups as $resource => $group)
                        <tr style="background:#f9fafb;">
                            <td colspan="{{ $roles->count() + 1 }}" style="padding:8px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#9ca3af;">
                                {{ $resource }}
                            </td>
                        </tr>
                        @foreach ($group['rows'] as $row)
                            <tr style="border-bottom:1px solid #f1f3f6;">
                                <td style="padding:8px 12px;white-space:nowrap;">
                                    <span style="font-weight:600;">{{ $row['label'] }}</span>
                                    <span style="color:#9ca3af;font-family:monospace;font-size:11px;margin-left:6px;">{{ $row['name'] }}</span>
                                </td>
                                @foreach ($roles as $role)
                                    <td style="text-align:center;padding:8px 12px;">
                                        @if ($row['roles'][$role->id])
                                            <span style="color:#16a34a;">✓</span>
                                        @else
                                            <span style="color:#d1d5db;">—</span>
                                        @endif
                                    </td>
                                @endforeach
                            </tr>
                        @endforeach
                    @endforeach
                </tbody>
            </table>
        </div>
    </x-filament::section>
</x-filament-panels::page>
