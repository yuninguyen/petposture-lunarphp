import React from 'react';
import BlogPostPage from '@/components/BlogPostPage';
import { Metadata } from 'next';

const BLOG_POSTS = [
    {
        id: 1,
        slug: "ultimate-guide-to-pet-posture",
        category: "Ergonomics",
        title: "The Ultimate Guide to Pet Posture: Why Ergonomics Matter for Longevity",
        excerpt: "Discover how simple changes in your pet's environment can prevent long-term spinal issues and improve their overall quality of life.",
        image: "/assets/Corgi.png",
        author: "Dr. Sarah Miller",
        date: "March 24, 2024",
        readTime: "8 min read"
    },
    {
        id: 2,
        slug: "dachshunding-101",
        category: "Breed Guides",
        title: "Dachshunding 101: Keeping Long-Backed Breeds Safe at Home",
        excerpt: "Specialized advice for owners of IVDD-prone breeds on how to navigate height and furniture safely.",
        image: "/assets/Shop-by-Breed.jpg",
        author: "James Wilson",
        date: "March 22, 2024",
        readTime: "5 min read"
    },
    {
        id: 3,
        slug: "orthopedic-vs-standard",
        category: "Health",
        title: "Orthopedic vs. Standard: Which Bed Does Your Senior Pet Really Need?",
        excerpt: "We break down the science of pressure points and joint support for aging cats and dogs.",
        image: "/assets/Pug-Dog-Bed.jpg",
        author: "Dr. Sarah Miller",
        date: "March 20, 2024",
        readTime: "6 min read"
    },
    {
        id: 4,
        slug: "creating-a-pet-first-home",
        category: "Lifestyle",
        title: "Creating a Pet-First Home Without Sacrificing Interior Design",
        excerpt: "Ergonomic furniture doesn't have to look like medical gear. Here's how to blend style and support.",
        image: "/assets/badposture-goodposture.jpg",
        author: "Elena Rossi",
        date: "March 18, 2024",
        readTime: "4 min read"
    },
    {
        id: 5,
        slug: "5-signs-traditional-bowls",
        category: "Health",
        title: "5 Signs Your Pet Is Struggling with Traditional Bowls",
        excerpt: "Signs like excessive splashing or hesitation before eating could mean your pet is in discomfort.",
        image: "/assets/Dog-Bowls-5.png",
        author: "James Wilson",
        date: "March 15, 2024",
        readTime: "7 min read"
    }
];

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
    const post = BLOG_POSTS.find(p => p.id.toString() === params.slug || p.slug === params.slug);
    return {
        title: post ? `${post.title} | Blog | PetPosture` : "Blog Post",
        description: post?.excerpt || "Pet Ergonomics Tips",
    };
}

export default function Page({ params }: { params: { slug: string } }) {
    // In a real app, this would be an API fetch
    const post = BLOG_POSTS.find(p => p.id.toString() === params.slug || p.slug === params.slug) || BLOG_POSTS[0];
    const recentPosts = BLOG_POSTS.filter(p => p.id !== post.id);

    return <BlogPostPage post={post} recentPosts={recentPosts} />;
}
