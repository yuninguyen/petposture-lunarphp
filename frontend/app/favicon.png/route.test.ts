import { afterEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { GET } from './route';

const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;

afterEach(() => {
  vi.unstubAllGlobals();
  process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
});

async function dimensions(response: Response) {
  return sharp(Buffer.from(await response.arrayBuffer())).metadata();
}

function settings(source: string | null) {
  return new Response(JSON.stringify({ data: { shop_favicon: source } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('GET /favicon.png', () => {
  it('normalizes an approved configured source to a 96x96 PNG', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.petposture.com';
    const source = await sharp({ create: { width: 180, height: 90, channels: 4, background: '#123456' } }).png().toBuffer();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(settings('https://api.petposture.com/storage/favicon.png'))
      .mockResolvedValueOnce(new Response(source, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET();
    const metadata = await dimensions(response);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('cache-control')).toContain('stale-while-revalidate=86400');
    expect(metadata).toMatchObject({ format: 'png', width: 96, height: 96 });
  });

  it.each([
    ['missing setting', settings(null)],
    ['settings failure', new Response('', { status: 503 })],
  ])('returns the filesystem fallback for %s', async (_case, firstResponse) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(firstResponse));
    const response = await GET();
    expect(await dimensions(response)).toMatchObject({ format: 'png', width: 96, height: 96 });
  });

  it('returns fallback when the source request or decode fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(settings('https://api.petposture.com/storage/favicon.png'))
      .mockResolvedValueOnce(new Response('', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await dimensions(await GET())).toMatchObject({ format: 'png', width: 96, height: 96 });
  });

  it('returns fallback when the source body cannot be decoded', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(settings('https://api.petposture.com/storage/favicon.png'))
      .mockResolvedValueOnce(new Response('not an image', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await dimensions(await GET())).toMatchObject({ format: 'png', width: 96, height: 96 });
  });

  it('returns fallback and cancels a source with an oversized declared length', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.petposture.com';
    const cancel = vi.fn().mockRejectedValue(new Error('cancel failed'));
    const body = { cancel };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(settings('https://api.petposture.com/storage/favicon.png'))
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Headers({ 'Content-Length': String(3 * 1024 * 1024) }),
        body,
      });
    vi.stubGlobal('fetch', fetchMock);
    const response = await GET();
    expect(await dimensions(response)).toMatchObject({ format: 'png', width: 96, height: 96 });
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(cancel).toHaveBeenCalledOnce();
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).signal?.aborted).toBe(true);
  });

  it('stops reading a chunked source as soon as it exceeds the byte limit', async () => {
    let pulls = 0;
    const chunk = new Uint8Array(1024 * 1024);
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(chunk);
        if (pulls === 10) controller.close();
      },
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(settings('https://api.petposture.com/storage/favicon.png'))
      .mockResolvedValueOnce(new Response(body, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await dimensions(await GET())).toMatchObject({ format: 'png', width: 96, height: 96 });
    expect(pulls).toBeLessThan(10);
  });

  it('rejects an unapproved external host without requesting it', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(settings('https://evil.example/favicon.png'));
    vi.stubGlobal('fetch', fetchMock);
    expect(await dimensions(await GET())).toMatchObject({ format: 'png', width: 96, height: 96 });
    expect(fetchMock.mock.calls.slice(1)).toHaveLength(0);
  });

  it('rejects redirects while fetching an approved source', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.petposture.com';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(settings('https://api.petposture.com/storage/favicon.png'))
      .mockRejectedValueOnce(new TypeError('redirect mode is set to error'));
    vi.stubGlobal('fetch', fetchMock);
    expect(await dimensions(await GET())).toMatchObject({ format: 'png', width: 96, height: 96 });
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ redirect: 'error' });
  });

  it('requires the configured API origin including port', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.petposture.com:8443/base';
    const fetchMock = vi.fn().mockResolvedValueOnce(settings('https://api.petposture.com/storage/favicon.png'));
    vi.stubGlobal('fetch', fetchMock);
    await GET();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.petposture.com:8443/base/api/settings');
  });
});
