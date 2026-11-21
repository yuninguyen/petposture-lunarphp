import { getApiBaseUrl } from '@/lib/api';

// The public "Buy on ..." link of a Pick. The backend records the click and knows the retailer URL;
// this route only lets the link live on petposture.com instead of showing the API host. It is never cached,
// because a cached redirect would send readers on without the click being counted.
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const headers: Record<string, string> = {};
    const referer = request.headers.get('referer');
    if (referer) headers.referer = referer;

    // Only a numeric variant id is passed on; the backend falls back to the product's link for any other value.
    // The button of the second store asks for exactly `retailer=second`; any other value is the first retailer.
    const search = new URL(request.url).searchParams;
    const variant = search.get('variant');
    const query = search.get('retailer') === 'second'
        ? '?retailer=second'
        : variant && /^\d+$/.test(variant) ? `?variant=${variant}` : '';

    try {
        const upstream = await fetch(`${getApiBaseUrl()}/go/pick/${encodeURIComponent(slug)}${query}`, {
            redirect: 'manual',
            cache: 'no-store',
            headers,
        });
        const location = upstream.headers.get('location');

        if (upstream.status >= 300 && upstream.status < 400 && location) {
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
