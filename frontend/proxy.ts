import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { buildContentSecurityPolicy } from '@/lib/content-security-policy';

export function proxy(request: NextRequest) {
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

    const token = request.cookies.get('petposture_token')?.value;
    const userJson = request.cookies.get('petposture_user')?.value;
    const { pathname } = request.nextUrl;

    // Admin routes protection
    if (pathname.startsWith('/admin')) {
        if (!token || !userJson) {
            return secure(NextResponse.redirect(new URL('/sign-in', request.url)));
        }

        try {
            const user = JSON.parse(userJson);
            const allowedRoles = ['super_admin', 'admin', 'staff', 'Product Manager', 'Order Manager', 'Support'];
            const hasAccess = user.roles && user.roles.some((role: string) => allowedRoles.includes(role));

            if (!hasAccess) {
                return secure(NextResponse.redirect(new URL('/', request.url)));
            }
        } catch {
            return secure(NextResponse.redirect(new URL('/sign-in', request.url)));
        }
    }

    // Customer account dashboard protection
    if (pathname.startsWith('/account') && (!token || !userJson)) {
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
