import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
    buildPrivateContentSecurityPolicy,
    buildPublicContentSecurityPolicy,
} from './lib/content-security-policy';
import {
    PRIVATE_HTML_CACHE_CONTROL,
    PUBLIC_HTML_CACHE_CONTROL,
    classifyStorefrontRequest,
} from './lib/storefront-request-policy';

type NavigationUser = { roles?: string[] };

async function fetchNavigationUser(request: NextRequest): Promise<NavigationUser | null> {
    const apiBase = (
        process.env.INTERNAL_API_URL ||
        process.env.NEXT_PUBLIC_API_URL ||
        'http://localhost:8000'
    ).replace(/\/$/, '');

    try {
        const response = await fetch(`${apiBase}/api/me`, {
            cache: 'no-store',
            headers: {
                Accept: 'application/json',
                Cookie: request.headers.get('cookie') || '',
                Origin: request.nextUrl.origin,
                Referer: request.url,
            },
        });

        if (!response.ok) return null;
        const payload = await response.json();
        return payload?.data ?? null;
    } catch {
        return null;
    }
}

export async function proxy(request: NextRequest) {
    // Confirmed (2026-09-07, `next start` + curl, not just a unit-test
    // harness): Next.js's own server unconditionally strips `rsc`,
    // `next-router-state-tree`, `next-router-segment-prefetch`, and
    // `next-router-prefetch` before this Proxy runs -- request.headers.get()
    // for these always returns null here, no matter what the client sent.
    // Cloudflare's edge rule is therefore the ONLY layer that can see and
    // exclude these four; the classifier still accepts them as facts so the
    // logic stays correct if that Next.js behavior ever changes, but they
    // are inert against real traffic today. `purpose` and `sec-purpose` are
    // NOT stripped and are genuinely enforced here.
    const requestHost = request.headers.get('host')?.split(':')[0] || request.nextUrl.hostname;
    const policy = classifyStorefrontRequest({
        host: requestHost,
        method: request.method,
        pathname: request.nextUrl.pathname,
        search: request.nextUrl.search,
        cookieHeader: request.headers.get('cookie') || '',
        cookieHeaderPresent: request.headers.has('cookie'),
        rsc: request.headers.get('rsc'),
        nextRouterStateTree: request.headers.get('next-router-state-tree'),
        nextRouterSegmentPrefetch: request.headers.get('next-router-segment-prefetch'),
        purpose: request.headers.get('purpose'),
        secPurpose: request.headers.get('sec-purpose'),
        nextRouterPrefetch: request.headers.get('next-router-prefetch'),
    });
    // Removing headers()/nonce from the root layout (Task 4) let every
    // route that doesn't itself call headers() go statically prerendered
    // (ISR), not just `/` -- confirmed against a real `npm run build`
    // (2026-09-07). Every path below is byte-identical for all visitors and
    // its HTML body never contains a nonce attribute, no matter why a given
    // request to it was classified private (cookie, query, prefetch, wrong
    // host, unsafe method). Emitting a nonce-required CSP for one of these
    // blocks every script on the page for that visitor, since the static
    // body can never match a per-request nonce -- reproduced live via a
    // real browser session on `/blog` carrying a session cookie
    // (2026-09-07: 21 console errors, page non-interactive). Bypass is
    // still safe: Cache-Control stays private/no-store below, so the
    // response is never cached; only the CSP choice changes.
    //
    // MAINTENANCE: this list must be re-derived from `npm run build`
    // output (routes marked "○") whenever a page's headers()/nonce usage
    // changes, or this exact bug reappears on whatever page silently
    // became static. There is no automatic check for this today.
    const STATIC_NO_NONCE_PATHS = new Set([
        '/',
        '/auth/reset-password',
        '/blog',
        '/cart',
        '/contact',
        '/dogs',
        '/our-mission',
        '/returns',
        '/shop/breeds',
        '/shop/breeds/flat-faced',
        '/shop/breeds/long-backed',
        '/shop/solutions',
        '/sign-in',
        '/sign-up',
        '/solutions',
        '/track-order',
        '/wishlist',
    ]);
    const isStaticNoNoncePage = STATIC_NO_NONCE_PATHS.has(request.nextUrl.pathname);
    const nonce = policy.kind === 'private' && !isStaticNoNoncePage
        ? Buffer.from(crypto.randomUUID()).toString('base64')
        : null;
    const contentSecurityPolicy = nonce
        ? buildPrivateContentSecurityPolicy(nonce)
        : buildPublicContentSecurityPolicy();
    const cacheControl = policy.kind === 'public-cacheable'
        ? PUBLIC_HTML_CACHE_CONTROL
        : PRIVATE_HTML_CACHE_CONTROL;
    const requestHeaders = new Headers(request.headers);
    requestHeaders.delete('x-nonce');
    if (nonce) requestHeaders.set('x-nonce', nonce);
    requestHeaders.set('Content-Security-Policy', contentSecurityPolicy);

    const secure = (response: NextResponse) => {
        response.headers.set('Content-Security-Policy', contentSecurityPolicy);
        response.headers.set('Cache-Control', cacheControl);
        return response;
    };
    const next = () => secure(NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    }));

    const { pathname } = request.nextUrl;

    // /account's own client-side AuthContext check already gates this route
    // reliably (confirmed working) — this middleware previously duplicated
    // that check via its own server-to-server fetch to /api/me, which
    // Laravel does not recognize as authenticated even with a valid,
    // correctly-forwarded session cookie, incorrectly bouncing logged-in
    // users back to /sign-in. Removed for /account; /admin keeps its own
    // gate below since that path hasn't been verified the same way.
    if (pathname.startsWith('/admin')) {
        const user = await fetchNavigationUser(request);

        if (!user) {
            return secure(NextResponse.redirect(new URL('/sign-in', request.url)));
        }

        const allowedRoles = ['super_admin', 'admin', 'staff', 'Product Manager', 'Order Manager', 'Support'];
        const hasAccess = user.roles?.some((role) => allowedRoles.includes(role)) ?? false;
        if (!hasAccess) {
            return secure(NextResponse.redirect(new URL('/', request.url)));
        }
    }

    return next();
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};
