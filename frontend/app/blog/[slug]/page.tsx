import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';

import BlogPostPage from '@/components/BlogPostPage';
import { API_BASE_URL } from '@/lib/api';
import { formatDate } from '@/lib/date';
import type { ComparisonData } from '@/components/blog/ComparisonTable';

type ApiPost = {
    id: string;
    slug: string;
    title: string;
    content?: string;
    type?: string;
    comparison?: ComparisonData | null;
    featured_image?: string | null;
    featured_image_alt?: string | null;
    author?: string | null;
    read_time?: string | null;
    created_at?: string | null;
    blog_category?: {
        id: string;
        name: string;
        slug?: string | null;
    } | null;
    seo?: {
        title?: string;
        keyphrase?: string;
        description?: string;
        og_title?: string;
        og_description?: string;
        og_image?: string;
    } | null;
};

type BlogPostViewModel = {
    id: number;
    slug: string;
    category: string;
    title: string;
    excerpt: string;
    content?: string;
    type: string;
    comparison?: ComparisonData | null;
    image: string;
    imageAlt?: string;
    author: string;
    date: string;
    readTime: string;
};

function toViewModel(post: ApiPost): BlogPostViewModel {
    const content = post.content || '';

    return {
        id: Number(post.id),
        slug: post.slug,
        category: post.blog_category?.name || 'Insights',
        title: post.title,
        excerpt: content.slice(0, 180) || post.title,
        content,
        type: post.type || 'article',
        comparison: post.comparison ?? null,
        image: post.featured_image || '/assets/placeholder-post.jpg',
        imageAlt: post.featured_image_alt || undefined,
        author: post.author || 'PetPosture Editorial',
        date: post.created_at ? formatDate(post.created_at) : 'Recently published',
        readTime: post.read_time || '5 min read',
    };
}

async function fetchPost(slug: string, previewQuery?: string): Promise<ApiPost | null> {
    try {
        const url = previewQuery
            ? `${API_BASE_URL}/api/posts/${slug}?${previewQuery}`
            : `${API_BASE_URL}/api/posts/${slug}`;

        const response = await fetch(url, {
            // Preview links carry a one-time signature; never cache them.
            cache: previewQuery ? 'no-store' : undefined,
            next: previewQuery ? undefined : { revalidate: 60 },
        });

        if (!response.ok) {
            return null;
        }

        const payload = await response.json();
        return payload?.data ?? null;
    } catch (error) {
        console.error('Failed to fetch blog post:', error);
        return null;
    }
}

function buildPreviewQuery(searchParams: Record<string, string | string[] | undefined>): string | undefined {
    const expires = searchParams.expires;
    const signature = searchParams.signature;

    if (typeof expires !== 'string' || typeof signature !== 'string') {
        return undefined;
    }

    return `expires=${encodeURIComponent(expires)}&signature=${encodeURIComponent(signature)}`;
}

async function fetchRecentPosts(currentSlug: string): Promise<ApiPost[]> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/posts`, {
            next: { revalidate: 60 },
        });

        if (!response.ok) {
            return [];
        }

        const payload = await response.json();
        const posts = Array.isArray(payload?.data) ? payload.data as ApiPost[] : [];

        return posts.filter((post) => post.slug !== currentSlug).slice(0, 3);
    } catch (error) {
        console.error('Failed to fetch recent blog posts:', error);
        return [];
    }
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: SearchParams }): Promise<Metadata> {
    const { slug } = await params;
    const post = await fetchPost(slug, buildPreviewQuery(await searchParams));

    if (!post) {
        return { title: 'Blog Post' };
    }

    const seo = post.seo;
    const title = seo?.title || `${post.title} | Blog`;
    const description = seo?.description || post.content?.slice(0, 160) || 'Pet ergonomics tips';
    const ogTitle = seo?.og_title || title;
    const ogDescription = seo?.og_description || description;
    const ogImage = seo?.og_image || post.featured_image || undefined;

    return {
        title,
        description,
        alternates: { canonical: `/blog/${slug}` },
        openGraph: {
            title: ogTitle,
            description: ogDescription,
            type: 'article',
            images: ogImage ? [{ url: ogImage }] : undefined,
        },
        twitter: {
            card: ogImage ? 'summary_large_image' : 'summary',
            title: ogTitle,
            description: ogDescription,
            images: ogImage ? [ogImage] : undefined,
        },
    };
}

export default async function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: SearchParams }) {
    const { slug } = await params;
    const previewQuery = buildPreviewQuery(await searchParams);

    const [post, recentPosts] = await Promise.all([
        fetchPost(slug, previewQuery),
        fetchRecentPosts(slug),
    ]);

    if (!post) {
        notFound();
    }

    return <BlogPostPage post={toViewModel(post)} recentPosts={recentPosts.map(toViewModel)} />;
}
