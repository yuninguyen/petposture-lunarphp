import { getApiBaseUrl } from '@/lib/api';

// The public "Buy on ..." link of a Pick. The backend records the click and knows the retailer URL;
// this route only lets the link live on petposture.com instead of showing the API host. It is never cached,
// because a cached redirect would send readers on without the click being counted.
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const headers: Record<string, string> = {};
    const referer = request.headers.get('referer');
    if (referer) headers.referer = referer;

    try {
        const upstream = await fetch(`${getApiBaseUrl()}/go/pick/${encodeURIComponent(slug)}`, {
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
        // fall through to the 404 below
    }

    return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
}
