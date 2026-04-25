# Media Contract Notes

## Current baseline
The codebase currently has two asset patterns in parallel:

- commerce images use Spatie media collections on legacy product models
- CMS/settings assets use file path strings stored directly in database fields such as `featured_image` and `shop_logo`

## Accepted short-term rule
Public APIs must normalize both forms into stable URLs for frontend consumers:

- if the stored value is already an absolute URL, return it unchanged
- if the stored value is a local upload path, return `asset('storage/...')`

## Why
The admin surfaces are already mixed:

- Filament post/settings forms can save uploaded file paths
- custom admin blog page can submit absolute image URLs

Without URL normalization, public API responses can return broken image URLs.

## Follow-up
- decide whether blog and settings assets should remain path-based
- if not, design a dedicated migration into a unified media abstraction instead of mixing file paths and media records ad hoc
