import { after } from 'next/server';
import { getApiBaseUrl } from '@/lib/api';
import { rememberedTarget, rememberTarget } from '@/lib/goTargets';

// The public "Buy on ..." link of a Pick. The backend records the click and knows the retailer URL;
// this route only lets the link live on petposture.com instead of showing the API host. The response is never
// cached by the browser or Cloudflare (a cached redirect would skip the count); the server itself remembers a link
// for a few minutes so a repeat press redirects at once and the click is counted in the background.
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const headers: Record<string, string> = {};
    const referer = request.headers.get('referer');
    if (referer) headers.referer = referer;

    // Only a numeric id is passed on: the backend falls back to the product's own link for any other value.
    // The button of one of the other stores asks for `merchant=<id>`. `retailer=second` is the older form of the same
    // thing (the first of the other stores), kept for links and cached pages that already carry it and asking for
    // exactly that value; any other `retailer` value is the first retailer. A variant id picks a variant's own link.
    const search = new URL(request.url).searchParams;
    const merchant = search.get('merchant');
    const variant = search.get('variant');
    const query = merchant && /^\d+$/.test(merchant)
        ? `?merchant=${merchant}`
        : search.get('retailer') === 'second'
            ? '?retailer=second'
            : variant && /^\d+$/.test(variant) ? `?variant=${variant}` : '';

    const backendUrl = `${getApiBaseUrl()}/go/pick/${encodeURIComponent(slug)}${query}`;
    const askBackend = () => fetch(backendUrl, { redirect: 'manual', cache: 'no-store', headers });
    const key = `${slug}${query}`;

    // A link seen in the last few minutes redirects at once; the backend still counts the click, just after the
    // reader has already left. The first press of a link, and the first after a few minutes, waits for the backend.
    const remembered = rememberedTarget(key);
    if (remembered) {
        after(async () => {
            try {
                await askBackend();
            } catch (error) {
                console.error('Could not record a Pick click:', error);
            }
        });

        return new Response(null, { status: 302, headers: { Location: remembered, 'Cache-Control': 'no-store' } });
    }

    try {
        const upstream = await askBackend();
        const location = upstream.headers.get('location');

        if (upstream.status >= 300 && upstream.status < 400 && location) {
            rememberTarget(key, location);

            return new Response(null, {
                status: 302,
                headers: { Location: location, 'Cache-Control': 'no-store' },
            });
        }
    } catch {
        // fall through to the Pick page below
    }

    // The backend gave no retailer link (unknown Pick, or briefly unreachable, for example while it restarts).
    // A reader who pressed Buy lands back on the Pick page rather than on a bare "Not found"; an unknown slug
    // gets that page's own 404.
    return new Response(null, { status: 302, headers: { Location: `/picks/${encodeURIComponent(slug)}`, 'Cache-Control': 'no-store' } });
}
