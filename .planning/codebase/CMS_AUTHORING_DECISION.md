# CMS Authoring Decision

## Status
Accepted for current architecture baseline.

## Decision
The project currently has two authoring surfaces for blog content:

- Filament `PostResource` is the full-featured editor
- frontend `/admin/blog` pages are a lightweight custom editorial UI

The canonical content model is still `App\Models\Post`, and both surfaces should operate against the same API contract.

## Immediate rules
1. Admin API responses for posts should use `PostResource` so public and custom admin consumers see a consistent shape.
2. The custom frontend admin blog pages should be treated as a lightweight layer, not a second full CMS.
3. Advanced editing flows such as rich media and SEO should continue to route users to Filament until the custom UI reaches feature parity.

## Follow-up work
- add a dedicated custom edit page only if it matches Filament authoring capabilities
- otherwise deprecate the custom create/edit UI and keep only a dashboard that links into Filament
