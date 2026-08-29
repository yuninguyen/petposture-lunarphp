import type { MetadataRoute } from 'next';
import { API_BASE_URL } from '@/lib/api';
import { SITE_URL } from '@/lib/site';

type ApiProduct = { slug?: string; categorySlug?: string; updated_at?: string };
type ApiPost = { slug?: string; updated_at?: string };

function validLastModified(value?: string): Date | undefined {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
}

async function fetchProducts(): Promise<ApiProduct[]> {
    const products: ApiProduct[] = [];
    let page = 1;
    let lastPage = 1;

    while (page <= lastPage) {
        try {
            const params = new URLSearchParams({ page: String(page), per_page: '100' });
            const res = await fetch(`${API_BASE_URL}/api/products?${params}`, { next: { revalidate: 3600 } });
            if (!res.ok) break;
            const payload = await res.json();
            if (!Array.isArray(payload?.data)) break;
            products.push(...payload.data);
            const reportedLastPage = payload?.meta?.last_page;
            lastPage = Number.isInteger(reportedLastPage) && reportedLastPage >= page
                ? reportedLastPage
                : page;
            page += 1;
        } catch {
            break;
        }
    }

    return products;
}

async function fetchPosts(): Promise<ApiPost[]> {
    try {
        const res = await fetch(`${API_BASE_URL}/api/posts`, { next: { revalidate: 3600 } });
        if (!res.ok) return [];
        const payload = await res.json();
        return Array.isArray(payload?.data) ? payload.data : [];
    } catch {
        return [];
    }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const staticPages: MetadataRoute.Sitemap = [
        { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 },
        { url: `${SITE_URL}/shop`, changeFrequency: 'daily', priority: 0.9 },
        { url: `${SITE_URL}/our-mission`, changeFrequency: 'monthly', priority: 0.6 },
        { url: `${SITE_URL}/blog`, changeFrequency: 'daily', priority: 0.7 },
        { url: `${SITE_URL}/dogs`, changeFrequency: 'weekly', priority: 0.8 },
        { url: `${SITE_URL}/dogs/dachshund`, changeFrequency: 'weekly', priority: 0.8 },
        { url: `${SITE_URL}/dogs/french-bulldog`, changeFrequency: 'weekly', priority: 0.8 },
        { url: `${SITE_URL}/dogs/pug`, changeFrequency: 'weekly', priority: 0.8 },
        { url: `${SITE_URL}/dogs/corgi`, changeFrequency: 'weekly', priority: 0.7 },
        { url: `${SITE_URL}/dogs/english-bulldog`, changeFrequency: 'weekly', priority: 0.7 },
        { url: `${SITE_URL}/shop/breeds`, changeFrequency: 'weekly', priority: 0.7 },
        { url: `${SITE_URL}/shop/breeds/flat-faced`, changeFrequency: 'weekly', priority: 0.7 },
        { url: `${SITE_URL}/shop/breeds/long-backed`, changeFrequency: 'weekly', priority: 0.7 },
        { url: `${SITE_URL}/shop/breeds/english-bulldog`, changeFrequency: 'weekly', priority: 0.7 },
        { url: `${SITE_URL}/shop/breeds/corgi`, changeFrequency: 'weekly', priority: 0.7 },
        { url: `${SITE_URL}/shop/breeds/dachshund`, changeFrequency: 'weekly', priority: 0.8 },
        { url: `${SITE_URL}/shop/breeds/french-bulldog`, changeFrequency: 'weekly', priority: 0.8 },
        { url: `${SITE_URL}/shop/breeds/pug`, changeFrequency: 'weekly', priority: 0.8 },
        { url: `${SITE_URL}/shop/solutions`, changeFrequency: 'weekly', priority: 0.7 },
        { url: `${SITE_URL}/shop/solutions/comfort`, changeFrequency: 'weekly', priority: 0.7 },
        { url: `${SITE_URL}/shop/solutions/feeding`, changeFrequency: 'weekly', priority: 0.7 },
        { url: `${SITE_URL}/shop/solutions/mobility`, changeFrequency: 'weekly', priority: 0.7 },
        { url: `${SITE_URL}/shop/solutions/walking`, changeFrequency: 'weekly', priority: 0.7 },
        { url: `${SITE_URL}/contact`, changeFrequency: 'monthly', priority: 0.5 },
        { url: `${SITE_URL}/faqs`, changeFrequency: 'monthly', priority: 0.5 },
        { url: `${SITE_URL}/track-order`, changeFrequency: 'monthly', priority: 0.3 },
        { url: `${SITE_URL}/returns`, changeFrequency: 'monthly', priority: 0.3 },
        { url: `${SITE_URL}/privacy-policy`, changeFrequency: 'yearly', priority: 0.2 },
        { url: `${SITE_URL}/terms-and-conditions`, changeFrequency: 'yearly', priority: 0.2 },
        { url: `${SITE_URL}/cookie-policy`, changeFrequency: 'yearly', priority: 0.2 },
        { url: `${SITE_URL}/acceptable-use-policy`, changeFrequency: 'yearly', priority: 0.2 },
        { url: `${SITE_URL}/affiliate-disclosure`, changeFrequency: 'yearly', priority: 0.2 },
        { url: `${SITE_URL}/return-refund-policy`, changeFrequency: 'yearly', priority: 0.2 },
        { url: `${SITE_URL}/shipping-policy`, changeFrequency: 'yearly', priority: 0.2 },
    ];

    const [products, posts] = await Promise.all([fetchProducts(), fetchPosts()]);

    const productPages: MetadataRoute.Sitemap = products
        .filter((p): p is Required<ApiProduct> => Boolean(p.slug && p.categorySlug))
        .map((p) => ({
            url: `${SITE_URL}/shop/${p.categorySlug}/${p.slug}`,
            lastModified: validLastModified(p.updated_at),
            changeFrequency: 'weekly',
            priority: 0.8,
        }));

    const postPages: MetadataRoute.Sitemap = posts
        .filter((p): p is Required<ApiPost> => Boolean(p.slug))
        .map((p) => ({
            url: `${SITE_URL}/blog/${p.slug}`,
            lastModified: validLastModified(p.updated_at),
            changeFrequency: 'monthly',
            priority: 0.6,
        }));

    return [...staticPages, ...productPages, ...postPages];
}
