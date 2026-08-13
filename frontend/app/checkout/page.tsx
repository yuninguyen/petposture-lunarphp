import CheckoutPage from '@/components/CheckoutPage';

// Prevent Next.js from statically prerendering this page. A static shell would
// ship with a cacheable Cache-Control header, and Cloudflare's zone-wide
// "Cache HTML pages" rule (any non-/api/ path) then caches it at the edge —
// this is what caused /checkout to serve stale HTML after deploys.
export const dynamic = 'force-dynamic';

export default function Page() {
  return <CheckoutPage />;
}
