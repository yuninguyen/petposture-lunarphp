import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

export const runtime = 'nodejs';

const SIZE = 96;
const TIMEOUT_MS = 5000;
const MAX_SETTINGS_BYTES = 64 * 1024;
const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
const MAX_INPUT_PIXELS = 16 * 1024 * 1024;
const FALLBACK_PATH = join(process.cwd(), 'public/assets/branding/favicon-fallback.png');
const CACHE_CONTROL = 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400';

function response(bytes: Buffer): Response {
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': CACHE_CONTROL,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function fallback(): Promise<Response> {
  return response(await readFile(FALLBACK_PATH));
}

function allowedOrigins(apiUrl: URL): Set<string> {
  const origins = new Set([apiUrl.origin]);
  if (apiUrl.hostname === 'localhost' || apiUrl.hostname === '127.0.0.1') {
    origins.add(`http://localhost${apiUrl.port ? `:${apiUrl.port}` : ''}`);
    origins.add(`http://127.0.0.1${apiUrl.port ? `:${apiUrl.port}` : ''}`);
  }
  return origins;
}

function isAllowedSource(source: string, apiUrl: URL): boolean {
  try {
    const url = new URL(source);
    return (url.protocol === 'http:' || url.protocol === 'https:')
      && allowedOrigins(apiUrl).has(url.origin);
  } catch {
    return false;
  }
}

async function fetchBytesWithTimeout(url: string, maxBytes: number): Promise<{ response: Response; bytes: Uint8Array }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const fetched = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      redirect: 'error',
    });
    const declaredLength = Number(fetched.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      controller.abort();
      await fetched.body?.cancel();
      throw new Error('response exceeds byte limit');
    }
    if (!fetched.body) return { response: fetched, bytes: new Uint8Array() };
    const reader = fetched.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error('response exceeds byte limit');
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { response: fetched, bytes };
  } finally {
    clearTimeout(timer);
  }
}

async function normalizedImage(source: string): Promise<Buffer> {
  const { response: sourceResponse, bytes } = await fetchBytesWithTimeout(source, MAX_SOURCE_BYTES);
  if (!sourceResponse.ok) throw new Error(`favicon source returned ${sourceResponse.status}`);
  return sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS }).resize(SIZE, SIZE, { fit: 'cover' }).png().toBuffer();
}

export async function GET(): Promise<Response> {
  try {
    const apiUrl = new URL(process.env.NEXT_PUBLIC_API_URL || 'https://api.petposture.com');
    const settingsUrl = new URL(`${apiUrl.pathname.replace(/\/$/, '')}/api/settings`, apiUrl);
    const { response: settingsResponse, bytes: settingsBytes } = await fetchBytesWithTimeout(settingsUrl.toString(), MAX_SETTINGS_BYTES);
    if (!settingsResponse.ok) return fallback();

    const json: unknown = JSON.parse(new TextDecoder().decode(settingsBytes));
    const source = typeof json === 'object' && json !== null
      && 'data' in json && typeof json.data === 'object' && json.data !== null
      && 'shop_favicon' in json.data && typeof json.data.shop_favicon === 'string'
      ? json.data.shop_favicon
      : null;

    if (!source || !isAllowedSource(source, apiUrl)) return fallback();
    return response(await normalizedImage(source));
  } catch {
    return fallback();
  }
}

export const __test__ = { allowedOrigins, isAllowedSource, normalizedImage };
