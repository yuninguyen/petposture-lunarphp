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

    it('passes a numeric variant id on to the backend so the click and the link follow the chosen variant', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: 'https://www.chewy.com/black/dp/2' } }));
        vi.stubGlobal('fetch', fetchMock);

        await GET(new Request('https://petposture.com/go/pick/kong-puppy?variant=176'), { params: Promise.resolve({ slug: 'kong-puppy' }) });
        expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/go\/pick\/kong-puppy\?variant=176$/);

        await GET(new Request('https://petposture.com/go/pick/kong-puppy?variant=abc%26x=1'), { params: Promise.resolve({ slug: 'kong-puppy' }) });
        expect(String(fetchMock.mock.calls[1][0])).toMatch(/\/go\/pick\/kong-puppy$/);
    });

    it('asks the backend for the second retailer only when the value is exactly "second"', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: 'https://www.petsmart.com/dog/x.html' } }));
        vi.stubGlobal('fetch', fetchMock);
        const go = (query: string) => GET(new Request(`https://petposture.com/go/pick/kong-puppy${query}`), { params: Promise.resolve({ slug: 'kong-puppy' }) });

        const response = await go('?retailer=second');
        expect(response.headers.get('location')).toBe('https://www.petsmart.com/dog/x.html');
        expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/go\/pick\/kong-puppy\?retailer=second$/);

        for (const [index, query] of ['?retailer=petsmart', '?retailer=', '?retailer=second%26x=1', '?retailer=SECOND'].entries()) {
            await go(query);
            expect(String(fetchMock.mock.calls[index + 1][0])).toMatch(/\/go\/pick\/kong-puppy$/);
        }
    });

    it('passes a numeric merchant id on, so the Buy button of another store opens that store and counts for it', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: 'https://www.petsmart.com/dog/x.html' } }));
        vi.stubGlobal('fetch', fetchMock);
        const go = (query: string) => GET(new Request(`https://petposture.com/go/pick/kong-puppy${query}`), { params: Promise.resolve({ slug: 'kong-puppy' }) });

        const response = await go('?merchant=3');
        expect(response.headers.get('location')).toBe('https://www.petsmart.com/dog/x.html');
        expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/go\/pick\/kong-puppy\?merchant=3$/);

        // anything that is not a plain number is not passed on, and a merchant id wins over the older forms
        for (const [index, query] of ['?merchant=abc', '?merchant=', '?merchant=3%26x=1', '?merchant=-1', '?merchant=1.5'].entries()) {
            await go(query);
            expect(String(fetchMock.mock.calls[index + 1][0])).toMatch(/\/go\/pick\/kong-puppy$/);
        }
        await go('?merchant=7&retailer=second&variant=9');
        expect(String(fetchMock.mock.calls[6][0])).toMatch(/\/go\/pick\/kong-puppy\?merchant=7$/);
    });

    it('sends the reader back to the Pick page when the backend gives no link or cannot be reached', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 404 })));
        const unknown = await ask('nothing');
        expect(unknown.status).toBe(302);
        expect(unknown.headers.get('location')).toBe('/picks/nothing');

        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
        const down = await ask('kong-puppy');
        expect(down.status).toBe(302);
        expect(down.headers.get('location')).toBe('/picks/kong-puppy');
        expect(down.headers.get('cache-control')).toBe('no-store');
    });
});
