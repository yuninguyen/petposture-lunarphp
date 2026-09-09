import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { revalidatePath, revalidateTag } from 'next/cache';
import * as route from './route';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
const secret = 'local-test-only-secret';
const policy = 'private, no-cache, no-store, max-age=0, must-revalidate';
function request(body: BodyInit | null = '{"scope":"homepage"}', headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/internal/storefront-revalidate', {
    method: 'POST', body, duplex: 'half',
    headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json', ...headers },
  } as RequestInit);
}
async function rejected(req: Request, status: number) {
  const response = await route.POST(req);
  expect(response.status).toBe(status);
  expect(response.headers.get('cache-control')).toBe(policy);
  expect(response.headers.has('set-cookie')).toBe(false);
  expect(await response.text()).not.toContain(secret);
  expect(revalidateTag).not.toHaveBeenCalled();
  expect(revalidatePath).not.toHaveBeenCalled();
}
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv('STOREFRONT_REVALIDATION_SECRET', secret); });
afterEach(() => vi.unstubAllEnvs());

describe('fixed homepage marking acknowledgement', () => {
  it('uses Node and invokes only both fixed expire-zero tags then homepage path', async () => {
    expect(route.runtime).toBe('nodejs');
    const response = await route.POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe(policy);
    expect(await response.json()).toEqual({ revalidated: true, scope: 'homepage' });
    expect(revalidateTag).toHaveBeenCalledTimes(2);
    expect(revalidateTag).toHaveBeenNthCalledWith(1, 'storefront-settings', { expire: 0 });
    expect(revalidateTag).toHaveBeenNthCalledWith(2, 'storefront-site-media', { expire: 0 });
    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith('/');
    expect(vi.mocked(revalidateTag).mock.invocationCallOrder[1]).toBeLessThan(vi.mocked(revalidatePath).mock.invocationCallOrder[0]);
  });
  it.each([undefined, ''])('fails closed without configuration %j', async (value) => {
    vi.stubEnv('STOREFRONT_REVALIDATION_SECRET', value);
    await rejected(request(), 503);
  });
  it.each(['', 'Bearer', 'Bearer ', 'Basic local-test-only-secret', 'bearer local-test-only-secret', 'Bearer wrong', `Bearer ${'x'.repeat(secret.length)}`, `Bearer ${'x'.repeat(4096)}`, `Bearer  ${secret}`, `Bearer ${secret},other`])('rejects non-exact authorization %j', async (authorization) => {
    await rejected(request(undefined, { authorization }), 401);
  });
  it('rejects missing authorization before reading body', async () => {
    const req = request(); req.headers.delete('authorization');
    await rejected(req, 401); expect(req.bodyUsed).toBe(false);
  });
  it.each(['', 'text/plain', 'application/jsonp', 'application/x-www-form-urlencoded'])('rejects content type %j', async (type) => {
    await rejected(request(undefined, { 'content-type': type }), 400);
  });
  it.each(['', '{', 'null', '[]', '"homepage"', '1', 'true', '{}', '{"scope":null}', '{"scope":"other"}', '{"scope":"homepage","path":"/"}', '{"scope":"homepage","tags":[]}', '{"scope":"homepage","extra":false}'])('rejects invalid fixed payload %j', async (body) => {
    await rejected(request(body), 400);
  });
  it('accepts JSON charset and exactly 1024 streamed bytes', async () => {
    const body = '{"scope":"homepage"}'.padEnd(1024, ' ');
    expect((await route.POST(request(body, { 'content-type': 'application/json; charset=utf-8' }))).status).toBe(200);
  });
  it.each<Record<string, string>>([{}, { 'content-length': '1' }])('rejects 1025 bytes regardless of declared length %j', async (headers) => {
    await rejected(request('{"scope":"homepage"}'.padEnd(1025, ' '), headers), 400);
  });
  it('counts multibyte UTF-8 bytes rather than characters', async () => {
    await rejected(request(JSON.stringify({ scope: 'homepage', extra: 'é'.repeat(510) })), 400);
  });
  it('stops and cancels after the streamed byte limit, without draining', async () => {
    let pulls = 0; const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      pull(controller) { pulls++; controller.enqueue(new Uint8Array(512).fill(32)); }, cancel,
    }, { highWaterMark: 0 });
    await rejected(request(body), 400);
    expect(pulls).toBe(3); expect(cancel).toHaveBeenCalledOnce();
  });
  it('rejects a failed body stream without invalidation', async () => {
    const body = new ReadableStream({ start(controller) { controller.error(new Error(secret)); } });
    await rejected(request(body), 400);
  });
  it.each(['tag', 'path'])('safely reports synchronous %s failure without reflecting details', async (stage) => {
    vi.mocked(stage === 'tag' ? revalidateTag : revalidatePath).mockImplementation(() => { throw new Error(secret); });
    const response = await route.POST(request());
    expect(response.status).toBe(503); expect(response.headers.get('cache-control')).toBe(policy);
    expect(await response.text()).not.toContain(secret);
    if (stage === 'tag') expect(revalidatePath).not.toHaveBeenCalled();
  });
  it.each(['GET', 'HEAD', 'OPTIONS', 'PUT', 'PATCH', 'DELETE'] as const)('explicitly rejects %s with private no-store and no CORS', async (method) => {
    const response = await route[method]();
    expect(response.status).toBe(405); expect(response.headers.get('allow')).toBe('POST');
    expect(response.headers.get('cache-control')).toBe(policy);
    expect(response.headers.has('access-control-allow-origin')).toBe(false);
    expect(await response.text()).toBe('');
    expect(revalidateTag).not.toHaveBeenCalled(); expect(revalidatePath).not.toHaveBeenCalled();
  });
});
