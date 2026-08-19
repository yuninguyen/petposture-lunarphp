import { connection } from 'next/server';
import CheckoutSuccessPage from '@/components/CheckoutSuccessPage';

// See app/checkout/page.tsx for why this must not be statically prerendered —
// same Cloudflare "Cache HTML pages" edge-caching issue applies to this route
// too. Using connection() (Next's replacement for `dynamic = 'force-dynamic'`)
// instead, since the older directive was hanging this useSearchParams() +
// Suspense page indefinitely in dev on this Next.js version.
export default async function Page() {
  await connection();
  return <CheckoutSuccessPage />;
}
