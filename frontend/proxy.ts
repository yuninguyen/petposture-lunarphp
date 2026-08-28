import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { buildContentSecurityPolicy } from '@/lib/content-security-policy';

type NavigationUser = { roles?: string[] };

async function fetchNavigationUser(request: NextRequest): Promise<NavigationUser | null> {
    const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

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
    const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
    const contentSecurityPolicy = buildContentSecurityPolicy(nonce);
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-nonce', nonce);
    requestHeaders.set('Content-Security-Policy', contentSecurityPolicy);

    const secure = (response: NextResponse) => {
        response.headers.set('Content-Security-Policy', contentSecurityPolicy);
        return response;
    };
    const next = () => secure(NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    }));

    const { pathname } = request.nextUrl;
    const needsUser = pathname.startsWith('/admin') || pathname.startsWith('/account');
    const user = needsUser ? await fetchNavigationUser(request) : null;

    if (pathname.startsWith('/admin')) {
        if (!user) {
            return secure(NextResponse.redirect(new URL('/sign-in', request.url)));
        }

        const allowedRoles = ['super_admin', 'admin', 'staff'];
        const hasAccess = user.roles?.some((role) => allowedRoles.includes(role)) ?? false;
        if (!hasAccess) {
            return secure(NextResponse.redirect(new URL('/', request.url)));
        }
    }

    if (pathname.startsWith('/account') && !user) {
        return secure(NextResponse.redirect(new URL('/sign-in', request.url)));
    }

    return next();
}

export const config = {
    matcher: [
        {
            source: '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
            missing: [
                { type: 'header', key: 'next-router-prefetch' },
                { type: 'header', key: 'purpose', value: 'prefetch' },
            ],
        },
    ],
};
