import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: [
                '/account',
                '/cart',
                '/checkout',
                '/auth',
                '/sign-in',
                '/sign-up',
                '/admin',
                '/product/',
                '/mission',
            ],
        },
        sitemap: `${SITE_URL}/sitemap.xml`,
    };
}
