import CheckoutPage from '@/components/CheckoutPage';

// Prevent Next.js from statically prerendering this page. A static shell would
// ship with a cacheable Cache-Control header, and Cloudflare's zone-wide
// "Cache HTML pages" rule (any non-/api/ path) then caches it at the edge —
// this is what caused /checkout to serve stale HTML after deploys.
export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <>
      {/* Hosts we load classic <script>s from (no crossorigin attribute) must be
          preconnected WITHOUT crossOrigin -- an anonymous preconnect opens a
          different socket pool, so the later script request would not reuse
          it. Hosts we only call with CORS fetch keep crossOrigin. */}
      <link rel="preconnect" href="https://js.stripe.com" />
      <link rel="preconnect" href="https://api.stripe.com" crossOrigin="anonymous" />
      <link rel="preconnect" href="https://www.paypal.com" />
      <link rel="preconnect" href="https://www.sandbox.paypal.com" />
      <link rel="preconnect" href="https://api-m.paypal.com" crossOrigin="anonymous" />
      <link rel="preconnect" href="https://api-m.sandbox.paypal.com" crossOrigin="anonymous" />
      <CheckoutPage />
    </>
  );
}
