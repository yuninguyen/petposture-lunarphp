import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRememberedTargets } from '@/lib/goTargets';
import { GET } from './route';

// `after` only works inside a request; here it runs the callback straight away and keeps the promise to wait on.
const pending: Promise<unknown>[] = [];
vi.mock('next/server', () => ({ after: (callback: () => Promise<void>) => { pending.push(callback()); } }));

const ask = (slug: string, referer?: string) =>
    GET(new Request(`https://petposture.com/go/pick/${slug}`, { headers: referer ? { referer } : {} }), { params: Promise.resolve({ slug }) });

describe('/go/pick/[slug]', () => {
    beforeEach(() => { clearRememberedTargets(); pending.length = 0; });
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
        const go = (query: string) => (clearRememberedTargets(), GET(new Request(`https://petposture.com/go/pick/kong-puppy${query}`), { params: Promise.resolve({ slug: 'kong-puppy' }) }));

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
        const go = (query: string) => (clearRememberedTargets(), GET(new Request(`https://petposture.com/go/pick/kong-puppy${query}`), { params: Promise.resolve({ slug: 'kong-puppy' }) }));

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

    it('redirects at once from a remembered link and has the backend count the click afterwards, with the referer', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: 'https://www.chewy.com/x/dp/1' } }));
        vi.stubGlobal('fetch', fetchMock);

        // first press: waits for the backend, which counts the click itself
        const first = await ask('kong-puppy');
        expect(first.headers.get('location')).toBe('https://www.chewy.com/x/dp/1');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(pending).toHaveLength(0);

        // second press: the answer does not wait for the backend; the count is sent afterwards
        let release: (value: Response) => void = () => {};
        fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => { release = resolve; }));
        const second = await ask('kong-puppy', 'https://petposture.com/picks/kong-puppy');
        expect(second.status).toBe(302);
        expect(second.headers.get('location')).toBe('https://www.chewy.com/x/dp/1');
        expect(second.headers.get('cache-control')).toBe('no-store');
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls[1][1].headers.referer).toBe('https://petposture.com/picks/kong-puppy');
        expect(pending).toHaveLength(1);
        release(new Response(null, { status: 302 }));
        await Promise.all(pending);
    });

    it('remembers a link per choice, so another store or variant of the same Pick is not sent to the first one', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://www.chewy.com/a' } }))
            .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://www.petsmart.com/b' } }))
            .mockResolvedValue(new Response(null, { status: 302 }));
        vi.stubGlobal('fetch', fetchMock);
        const go = (query: string) => GET(new Request(`https://petposture.com/go/pick/kong-puppy${query}`), { params: Promise.resolve({ slug: 'kong-puppy' }) });

        expect((await go('')).headers.get('location')).toBe('https://www.chewy.com/a');
        expect((await go('?merchant=3')).headers.get('location')).toBe('https://www.petsmart.com/b');
        expect((await go('?merchant=3')).headers.get('location')).toBe('https://www.petsmart.com/b');
        expect((await go('')).headers.get('location')).toBe('https://www.chewy.com/a');
        await Promise.all(pending);
    });

    it('does not remember a failed answer, and a lost background count does not break the redirect', async () => {
        const failing = vi.fn().mockResolvedValue(new Response('nope', { status: 404 }));
        vi.stubGlobal('fetch', failing);
        await ask('kong-puppy');
        await ask('kong-puppy');
        expect(failing).toHaveBeenCalledTimes(2);

        const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://www.chewy.com/a' } }));
        vi.stubGlobal('fetch', fetchMock);
        await ask('kong-puppy');
        fetchMock.mockRejectedValueOnce(new Error('down'));
        const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
        const again = await ask('kong-puppy');
        await Promise.all(pending);
        expect(again.headers.get('location')).toBe('https://www.chewy.com/a');
        expect(quiet).toHaveBeenCalled();
        quiet.mockRestore();
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
