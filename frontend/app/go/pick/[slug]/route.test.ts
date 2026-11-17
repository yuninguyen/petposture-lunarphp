import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const ask = (slug: string, referer?: string) =>
    GET(new Request(`https://petposture.com/go/pick/${slug}`, { headers: referer ? { referer } : {} }), { params: Promise.resolve({ slug }) });

describe('/go/pick/[slug]', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('passes the retailer redirect on without letting anything cache it, and hands the referer to the click log', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: 'https://www.chewy.com/x/dp/1' } }));
        vi.stubGlobal('fetch', fetchMock);

        const response = await ask('kong-puppy', 'https://petposture.com/picks/kong-puppy');

        expect(response.status).toBe(302);
        expect(response.headers.get('location')).toBe('https://www.chewy.com/x/dp/1');
        expect(response.headers.get('cache-control')).toBe('no-store');
        const [url, init] = fetchMock.mock.calls[0];
        expect(String(url)).toMatch(/\/go\/pick\/kong-puppy$/);
        expect(init.redirect).toBe('manual');
        expect(init.headers.referer).toBe('https://petposture.com/picks/kong-puppy');
    });

    it('answers 404 when the backend does not know the Pick or cannot be reached', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 404 })));
        expect((await ask('nothing')).status).toBe(404);

        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
        const down = await ask('kong-puppy');
        expect(down.status).toBe(404);
        expect(down.headers.get('cache-control')).toBe('no-store');
    });
});
