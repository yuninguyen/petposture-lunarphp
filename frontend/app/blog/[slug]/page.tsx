import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';

import BlogPostPage from '@/components/BlogPostPage';
import { API_BASE_URL } from '@/lib/api';

type ApiPost = {
    id: string;
    slug: string;
    title: string;
    content?: string;
    featured_image?: string | null;
    author?: string | null;
    read_time?: string | null;
    created_at?: string | null;
    blog_category?: {
        id: string;
        name: string;
        slug?: string | null;
    } | null;
};

type BlogPostViewModel = {
    id: number;
    slug: string;
    category: string;
    title: string;
    excerpt: string;
    content?: string;
    image: string;
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
        image: post.featured_image || '/assets/placeholder-post.jpg',
        author: post.author || 'PetPosture Editorial',
        date: post.created_at ? new Date(post.created_at).toLocaleDateString() : 'Recently published',
        readTime: post.read_time || '5 min read',
    };
}

async function fetchPost(slug: string): Promise<ApiPost | null> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/posts/${slug}`, {
            next: { revalidate: 60 },
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

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params;
    const post = await fetchPost(slug);

    return {
        title: post ? `${post.title} | Blog | PetPosture` : 'Blog Post',
        description: post?.content?.slice(0, 160) || 'Pet ergonomics tips',
    };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;

    const [post, recentPosts] = await Promise.all([
        fetchPost(slug),
        fetchRecentPosts(slug),
    ]);

    if (!post) {
        notFound();
    }

    return <BlogPostPage post={toViewModel(post)} recentPosts={recentPosts.map(toViewModel)} />;
}
