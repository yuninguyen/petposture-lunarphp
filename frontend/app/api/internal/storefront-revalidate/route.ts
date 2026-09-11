import { timingSafeEqual } from 'node:crypto';
import { revalidatePath, revalidateTag } from 'next/cache';
import { STOREFRONT_SETTINGS_TAG, STOREFRONT_SITE_MEDIA_TAG } from '../../../../lib/storefront-cache-tags';

export const runtime = 'nodejs';
const CACHE_CONTROL = 'private, no-cache, no-store, max-age=0, must-revalidate';
const MAX_BODY_BYTES = 1024;

function reply(status: number, body: object): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': CACHE_CONTROL } });
}

async function readScope(request: Request): Promise<boolean> {
  if (!request.body) return false;
  const reader = request.body.getReader();
  const bytes = new Uint8Array(MAX_BODY_BYTES);
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (size + value.byteLength > MAX_BODY_BYTES) {
        // Do not drain an unbounded body or wait for the sender to finish.
        void reader.cancel().catch(() => {});
        return false;
      }
      bytes.set(value, size);
      size += value.byteLength;
    }
    const body: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, size)));
    return typeof body === 'object' && body !== null && !Array.isArray(body)
      && Object.keys(body).length === 1 && 'scope' in body && body.scope === 'homepage';
  } catch {
    return false;
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const secret = process.env.STOREFRONT_REVALIDATION_SECRET;
    if (!secret) return reply(503, { error: 'Revalidation unavailable' });
    const authorization = request.headers.get('authorization') || '';
    const expected = Buffer.from(`Bearer ${secret}`, 'utf8');
    const supplied = Buffer.from(authorization, 'utf8');
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      return reply(401, { error: 'Unauthorized' });
    }
    const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
    if (contentType !== 'application/json' || !await readScope(request)) {
      return reply(400, { error: 'Invalid request' });
    }
    revalidateTag(STOREFRONT_SETTINGS_TAG, { expire: 0 });
    revalidateTag(STOREFRONT_SITE_MEDIA_TAG, { expire: 0 });
    revalidatePath('/');
    // Acknowledges marking calls only, not persisted invalidation or regenerated HTML.
    return reply(200, { revalidated: true, scope: 'homepage' });
  } catch {
    // Later asynchronous cache-handler failures are outside this synchronous boundary.
    return reply(503, { error: 'Revalidation unavailable' });
  }
}

function methodNotAllowed(): Response {
  return new Response(null, { status: 405, headers: { 'Cache-Control': CACHE_CONTROL, Allow: 'POST' } });
}

// Explicit HEAD/OPTIONS prevent framework-generated replies bypassing no-store.
export { methodNotAllowed as GET, methodNotAllowed as HEAD, methodNotAllowed as OPTIONS,
  methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE };
