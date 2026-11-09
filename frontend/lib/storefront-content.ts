import type { BlogCategory, BlogPost } from '../components/BlogPage';
import type { Product } from '../types/shop';
import { getApiBaseUrl } from './api';
import { formatDate } from './date';
import { stripHtml } from './text';

// Kept in step with the hero image fetch on the homepage and with the
// Cloudflare s-maxage on `/`, so a content change shows up within minutes.
const REVALIDATE_SECONDS = 300;
const BEST_SELLER_COUNT = 4;
const INSIGHT_COUNT = 3;
// BlogPage cuts its own excerpt from `content` (160 chars), so the server only
// has to hand over a little more than that instead of the whole article.
const BLOG_EXCERPT_SOURCE_LENGTH = 200;

export type InsightPost = {
    slug: string;
    cat: string;
    title: string;
    excerpt: string;
    date: string;
    readTime: string;
    img: string | null;
};

type ApiInsightRow = {
    slug: string;
    title: string;
    content?: string;
    featured_image?: string | null;
    read_time?: string | null;
    published_at?: string | null;
    created_at?: string | null;
    blog_category?: { name?: string } | null;
};

export function toInsightPost(post: ApiInsightRow): InsightPost {
    return {
        slug: post.slug,
        cat: post.blog_category?.name || 'Insights',
        title: post.title,
        excerpt: stripHtml(post.content || '').slice(0, 140),
        date: formatDate(post.published_at || post.created_at || new Date().toISOString()),
        readTime: post.read_time || '5 min read',
        img: post.featured_image || null,
    };
}

// Returns null on any failure so callers can fall back to fetching in the
// browser. During `next build` the VPS only reaches the API through Cloudflare,
// which answers 403, so a null here is an expected outcome and not an error.
async function fetchRows<T>(path: string): Promise<T[] | null> {
    try {
        const res = await fetch(`${getApiBaseUrl()}${path}`, { next: { revalidate: REVALIDATE_SECONDS } });
        if (!res.ok) return null;
        const json = await res.json();
        return Array.isArray(json?.data) ? json.data : null;
    } catch {
        return null;
    }
}

export async function fetchBestSellers(): Promise<Product[] | null> {
    const rows = await fetchRows<Product>('/api/products?category=best-sellers');
    return rows ? rows.slice(0, BEST_SELLER_COUNT) : null;
}

export async function fetchInsightPosts(): Promise<InsightPost[] | null> {
    const rows = await fetchRows<ApiInsightRow>('/api/posts');
    return rows ? rows.slice(0, INSIGHT_COUNT).map(toInsightPost) : null;
}

export async function fetchBlogIndex(): Promise<{ posts: BlogPost[]; categories: BlogCategory[] } | null> {
    const [posts, categories] = await Promise.all([
        fetchRows<BlogPost>('/api/posts'),
        fetchRows<BlogCategory>('/api/blog/categories'),
    ]);
    if (!posts || !categories) return null;

    return {
        posts: posts.map((post) => ({
            ...post,
            content: stripHtml(post.content || '').slice(0, BLOG_EXCERPT_SOURCE_LENGTH),
        })),
        categories,
    };
}
