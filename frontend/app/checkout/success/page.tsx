import CheckoutSuccessPage from '@/components/CheckoutSuccessPage';

// See app/checkout/page.tsx for why this must stay force-dynamic — same
// Cloudflare "Cache HTML pages" edge-caching issue applies to this route too.
export const dynamic = 'force-dynamic';

export default function Page() {
  return <CheckoutSuccessPage />;
}
