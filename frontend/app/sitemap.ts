import type { MetadataRoute } from 'next';
import { API_BASE_URL } from '@/lib/api';
import { SITE_URL } from '@/lib/site';

type ApiProduct = { slug?: string; categorySlug?: string };
type ApiPost = { slug?: string };

async function fetchProducts(): Promise<ApiProduct[]> {
    try {
        const res = await fetch(`${API_BASE_URL}/api/products`, { next: { revalidate: 3600 } });
        if (!res.ok) return [];
        const payload = await res.json();
        return Array.isArray(payload?.data) ? payload.data : [];
    } catch {
        return [];
    }
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
        { url: `${SITE_URL}/blog`, changeFrequency: 'daily', priority: 0.7 },
        { url: `${SITE_URL}/our-mission`, changeFrequency: 'monthly', priority: 0.6 },
        { url: `${SITE_URL}/contact`, changeFrequency: 'monthly', priority: 0.5 },
        { url: `${SITE_URL}/faqs`, changeFrequency: 'monthly', priority: 0.5 },
        { url: `${SITE_URL}/track-order`, changeFrequency: 'monthly', priority: 0.3 },
        { url: `${SITE_URL}/privacy-policy`, changeFrequency: 'yearly', priority: 0.2 },
        { url: `${SITE_URL}/terms-and-conditions`, changeFrequency: 'yearly', priority: 0.2 },
        { url: `${SITE_URL}/cookie-policy`, changeFrequency: 'yearly', priority: 0.2 },
        { url: `${SITE_URL}/acceptable-use-policy`, changeFrequency: 'yearly', priority: 0.2 },
        { url: `${SITE_URL}/return-refund-policy`, changeFrequency: 'yearly', priority: 0.2 },
        { url: `${SITE_URL}/shipping-policy`, changeFrequency: 'yearly', priority: 0.2 },
    ];

    const [products, posts] = await Promise.all([fetchProducts(), fetchPosts()]);

    const productPages: MetadataRoute.Sitemap = products
        .filter((p): p is Required<ApiProduct> => Boolean(p.slug && p.categorySlug))
        .map((p) => ({
            url: `${SITE_URL}/shop/${p.categorySlug}/${p.slug}`,
            changeFrequency: 'weekly',
            priority: 0.8,
        }));

    const postPages: MetadataRoute.Sitemap = posts
        .filter((p): p is Required<ApiPost> => Boolean(p.slug))
        .map((p) => ({
            url: `${SITE_URL}/blog/${p.slug}`,
            changeFrequency: 'monthly',
            priority: 0.6,
        }));

    return [...staticPages, ...productPages, ...postPages];
}
