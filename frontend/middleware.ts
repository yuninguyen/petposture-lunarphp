import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const token = request.cookies.get('petposture_token')?.value;
    const userJson = request.cookies.get('petposture_user')?.value;

    const { pathname } = request.nextUrl;

    // Admin routes protection
    if (pathname.startsWith('/admin')) {
        if (!token || !userJson) {
            return NextResponse.redirect(new URL('/auth/login', request.url));
        }

        try {
            const user = JSON.parse(userJson);
            const allowedRoles = ['super_admin', 'admin', 'staff', 'Product Manager', 'Order Manager', 'Support'];
            const hasAccess = user.roles && user.roles.some((role: string) => allowedRoles.includes(role));

            if (!hasAccess) {
                return NextResponse.redirect(new URL('/', request.url));
            }
        } catch (e) {
            return NextResponse.redirect(new URL('/auth/login', request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/admin/:path*'],
};
