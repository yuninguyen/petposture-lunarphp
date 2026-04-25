# Settings and Media Decision

## Status
Accepted for current architecture baseline.

## Decision
The project should treat settings and media as two separate concerns for now:

- `App\Filament\Pages\ManageSettings` is the canonical admin surface for site-wide settings stored in the `settings` table.
- `App\Filament\Resources\SettingResource` is a legacy raw key/value editor and should be treated as deprecated admin infrastructure, not the primary UI.
- `App\Filament\Resources\MediaResource` is an inspection and cleanup surface for Spatie media records, not the canonical authoring flow for blog images or site settings assets.

## Why
The current codebase has two different admin surfaces writing to the same `settings` table:

- `ManageSettings` writes business-facing keys such as `shop_name`, `shop_logo`, `default_currency`, and SMTP settings.
- `SettingResource` exposes unrestricted key/value CRUD over the same records.

Keeping both surfaces active in navigation creates avoidable drift and makes it unclear which workflow the team should use.

Media is also intentionally mixed today:

- settings logo and blog featured images are stored as file path strings
- `MediaResource` reads Spatie media records that are not yet the canonical source for those assets

So the safe short-term move is to clarify boundaries, not force a half-migration.

## Immediate rules
1. Site settings should be edited through `ManageSettings`.
2. API consumers should read storefront settings from `SettingsController`, not from raw key/value assumptions.
3. `SettingResource` should stay hidden from normal admin navigation until there is a deliberate need for low-level settings maintenance.
4. Media usage should remain path-based where already implemented until a full asset migration plan exists.

## Follow-up work
- decide whether blog images should stay file-path based or move to a unified media abstraction
- decide whether settings assets should move into Spatie media or remain simple uploads
- remove `SettingResource` entirely after confirming there are no operational users depending on raw key editing
