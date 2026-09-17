# Task 10 — Final Verification and Review Fix Wave

## Security ruling: private outbound destinations

Ruling: Do not add SSRF/private-network restrictions to SMTP hosts or OpenAI-compatible base URLs.

Reason: private SMTP relays and private/self-hosted OpenAI-compatible proxies are intentional supported deployments. These endpoints are available only to authenticated core-admin roles (`super_admin`, `admin`, `staff`), who are trusted outbound configuration operators. Blocking private destinations would break required deployment behavior rather than harden an untrusted public input surface.

Cost if this trust model changes: route authorization and outbound destination policy must be redesigned together; a generic private-address denylist must not be added independently because it would reject legitimate internal services.

## Final review findings addressed

- Cross-tab SMTP/AI save identities now survive form unmount/remount without storing credential candidates. Older save responses cannot overwrite newer QueryClient safe state.
- OpenAI model fetch returns sanitized fetched IDs on effective-model mismatch (`422`); frontend consumes only the typed safe error envelope, displays recovered IDs, and keeps Save gated until selection plus a successful refetch.
- External clean QueryClient adoption clears stale save-success state.
- `backend/routes/api.php` was formatted with Pint without intended route semantic changes.
