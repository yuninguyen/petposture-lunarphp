"use client";

import React from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronRight,
    Share2,
    User,
    Calendar,
    Clock,
    ArrowLeft,
    Facebook,
    Twitter,
    Instagram
} from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import ComparisonTable, { ComparisonData } from '@/components/blog/ComparisonTable';
import { useSettings } from '@/context/SettingsContext';
import { withTableOfContents } from '@/lib/text';

const fadeUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

interface BlogPost {
    id: number;
    category: string;
    title: string;
    excerpt: string;
    content?: string;
    type?: string;
    comparison?: ComparisonData | null;
    image: string;
    imageAlt?: string;
    author: string;
    date: string;
    readTime: string;
}

interface BlogPostPageProps {
    post: BlogPost;
    recentPosts: BlogPost[];
}

export default function BlogPostPage({ post, recentPosts }: BlogPostPageProps) {
    const { social } = useSettings();
    const [isCommenting, setIsCommenting] = React.useState(false);
    const { html: contentHtml, items: tocItems } = React.useMemo(
        () => withTableOfContents(post.content || `<p>${post.excerpt}</p>`),
        [post.content, post.excerpt]
    );

    return (
        <main className="min-h-screen bg-white font-hanken overflow-x-hidden">
            <Header />

            {/* Post Hero Section */}
            <section className="bg-[#f8f9fa] pt-12 pb-20 px-4 md:px-8 border-b border-zinc-100">
                <div className="max-w-[900px] mx-auto text-center">
                    <motion.div
                        initial="initial"
                        animate="animate"
                        variants={fadeUp}
                    >
                        <Link href="/blog" className="inline-flex items-center gap-2 text-secondary font-bold uppercase tracking-widest text-sm mb-8 hover:translate-x-[-4px] transition-transform">
                            <ArrowLeft size={14} /> Back to Blog
                        </Link>

                        <div className="flex justify-center mb-6">
                            <span className="bg-secondary/10 text-secondary text-xs font-bold uppercase tracking-[0.2em] px-4 py-2 rounded-[3px]">
                                {post.category}
                            </span>
                        </div>

                        <h1 className="text-[32px] md:text-[48px] lg:text-[56px] font-bold text-primary leading-[1.1] mb-8">
                            {post.title}
                        </h1>

                        <div className="flex flex-wrap items-center justify-center gap-6 text-zinc-400 text-xs font-medium">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center overflow-hidden border border-zinc-300">
                                    <User size={16} className="text-zinc-500" />
                                </div>
                                <span className="text-primary font-bold">{post.author}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Calendar size={14} className="text-secondary" />
                                <span>{post.date}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock size={14} className="text-secondary" />
                                <span>{post.readTime}</span>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Main Content Area */}
            <section className="py-16 md:py-24 px-4 md:px-8">
                <div className="max-w-[1200px] mx-auto flex flex-col lg:flex-row gap-16">

                    {/* Article Content column */}
                    <div className="lg:w-[70%]">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.8 }}
                            className="rounded-2xl overflow-hidden shadow-2xl shadow-zinc-200/50 mb-12 border border-zinc-100"
                        >
                            <div className="relative aspect-[16/9]">
                                <Image
                                    src={post.image}
                                    alt={post.imageAlt || post.title}
                                    fill
                                    sizes="(max-width: 1024px) 100vw, 70vw"
                                    className="object-cover"
                                />
                            </div>
                        </motion.div>

                        {post.type === 'comparison' && post.comparison ? (
                            <ComparisonTable data={post.comparison} />
                        ) : null}

                        <article
                            className="prose prose-zinc max-w-none text-primary text-[18px] md:text-[20px] leading-[1.8] font-medium [&>p:first-of-type]:first-letter:text-5xl [&>p:first-of-type]:first-letter:font-bold [&>p:first-of-type]:first-letter:text-secondary [&>p:first-of-type]:first-letter:mr-3 [&>p:first-of-type]:first-letter:float-left [&>*+*]:mt-8 [&_h2]:text-[28px] [&_h2]:md:text-[32px] [&_h2]:font-bold [&_h2]:text-primary [&_h2]:mt-12 [&_h2]:mb-6 [&_blockquote]:border-l-4 [&_blockquote]:border-secondary [&_blockquote]:pl-8 [&_blockquote]:py-4 [&_blockquote]:bg-secondary-light [&_blockquote]:rounded-r-xl [&_blockquote]:italic [&_blockquote]:text-[22px] [&_blockquote]:text-primary [&_blockquote]:font-semibold [&_blockquote]:not-italic"
                            dangerouslySetInnerHTML={{ __html: contentHtml }}
                        />

                        {/* Article Footer */}
                        <div className="mt-16 pt-10 border-t border-zinc-100">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="flex items-center gap-4">
                                    <span className="text-zinc-400 text-sm font-bold uppercase tracking-wider">Share this story:</span>
                                    <div className="flex items-center gap-2">
                                        {[
                                            { icon: Facebook, color: "#1877F2" },
                                            { icon: Twitter, color: "#000000" },
                                            { icon: Share2, color: "#df8448" }
                                        ].map((soc, i) => (
                                            <button key={i} className="w-10 h-10 rounded-full border border-zinc-100 flex items-center justify-center text-zinc-400 hover:border-secondary hover:text-secondary transition-all bg-white shadow-sm">
                                                <soc.icon size={16} />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {["Health", "Guideline", "Senior Pets"].map(tag => (
                                        <span key={tag} className="text-xs font-bold text-primary/60 border border-zinc-200 px-4 py-1.5 rounded-[3px] hover:bg-zinc-50 cursor-pointer transition-colors bg-white shadow-sm uppercase tracking-widest">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Comments Section */}
                        <div className="mt-24 space-y-16">
                            <div className="flex items-center gap-4">
                                <h3 className="text-[24px] font-bold text-primary">Discussion</h3>
                                <div className="flex-1 h-[1px] bg-zinc-100" />
                                <span className="bg-zinc-50 text-zinc-400 px-3 py-1 rounded-full text-xs font-bold">2</span>
                            </div>

                            <div className="space-y-10">
                                <div className="flex gap-6">
                                    <div className="w-12 h-12 rounded-full bg-zinc-100 shrink-0 overflow-hidden border border-zinc-200 flex items-center justify-center">
                                        <User size={24} className="text-zinc-400" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-2">
                                            <h5 className="text-[14px] font-bold text-primary">Michael Chen</h5>
                                            <span className="text-xs text-zinc-400">Mar 25, 2024</span>
                                        </div>
                                        <p className="text-[#666666] text-[15px] leading-relaxed">
                                            This is exactly the information I was looking for! My Dachshund has been showing some signs of discomfort during meals, and I&apos;ll definitely look into a tilted bowl.
                                        </p>
                                        <button className="mt-4 text-sm font-bold text-secondary uppercase tracking-widest hover:text-primary transition-colors">Reply</button>
                                    </div>
                                </div>
                            </div>

                            {/* Leave a Comment Form */}
                            <div className="space-y-8">
                                <button
                                    onClick={() => setIsCommenting(!isCommenting)}
                                    className="w-full flex items-center justify-center gap-3 py-4 border border-zinc-100 rounded-2xl hover:bg-zinc-50 hover:border-secondary/20 transition-all group"
                                >
                                    <h3 className="text-[16px] font-bold text-primary group-hover:text-secondary">Leave a Comment</h3>
                                    <motion.div
                                        animate={{ rotate: isCommenting ? 180 : 0 }}
                                        className="text-secondary"
                                    >
                                        <ChevronRight size={18} className="rotate-90" />
                                    </motion.div>
                                </button>

                                <AnimatePresence>
                                    {isCommenting && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="bg-[#f8f9fa] rounded-2xl p-6 md:p-7 border border-zinc-100">
                                                <div className="mb-6">
                                                    <h3 className="text-[16px] font-bold text-primary mb-1">Leave a Reply</h3>
                                                    <p className="text-zinc-500 text-[13px]">Your email address will not be published. Required fields are marked *</p>
                                                </div>
                                                <form className="space-y-4">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="space-y-1.5">
                                                            <label className="text-xs font-bold text-primary uppercase tracking-wide ml-1">Name *</label>
                                                            <input type="text" className="w-full px-4 py-3 rounded-[3px] bg-white border border-zinc-200 outline-none focus:border-secondary text-[14px]" placeholder="John Doe" />
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <label className="text-xs font-bold text-primary uppercase tracking-wide ml-1">Email *</label>
                                                            <input type="email" className="w-full px-4 py-3 rounded-[3px] bg-white border border-zinc-200 outline-none focus:border-secondary text-[14px]" placeholder="john@example.com" />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-bold text-primary uppercase tracking-wide ml-1">Website</label>
                                                        <input type="text" className="w-full px-4 py-3 rounded-[3px] bg-white border border-zinc-200 outline-none focus:border-secondary text-[14px]" placeholder="Optional" />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-bold text-primary uppercase tracking-wide ml-1">Comment *</label>
                                                        <textarea rows={5} className="w-full px-4 py-3 rounded-[3px] bg-white border border-zinc-200 outline-none focus:border-secondary text-[14px] resize-none" placeholder="Your message here..." />
                                                    </div>
                                                    <div className="flex items-center gap-3 py-2">
                                                        <input type="checkbox" id="save-info" className="w-4 h-4 rounded border-zinc-300 text-secondary focus:ring-secondary" />
                                                        <label htmlFor="save-info" className="text-sm text-zinc-500">Save my name, email, and website in this browser for the next time I comment.</label>
                                                    </div>
                                                    <button className="bg-secondary text-white px-8 py-3 rounded-[3px] font-bold uppercase tracking-[0.1em] text-sm hover:bg-secondary-dark transition-all shadow-lg shadow-orange-200/50">
                                                        Post Comment
                                                    </button>
                                                </form>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </div>

                    {/* Sidebar column */}
                    <aside className="lg:w-[30%] space-y-12">

                        {/* Table of Contents Widget */}
                        {tocItems.length > 0 && (
                            <div className="bg-white rounded-2xl p-8 border border-zinc-100 shadow-xl shadow-zinc-100">
                                <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-secondary mb-6 flex items-center gap-3">
                                    On This Page
                                    <div className="flex-1 h-[1px] bg-zinc-200" />
                                </h4>
                                <nav className="space-y-3">
                                    {tocItems.map((item) => (
                                        <a
                                            key={item.id}
                                            href={`#${item.id}`}
                                            className={`block text-[14px] font-medium text-primary hover:text-secondary transition-colors ${item.level === 3 ? 'pl-4 text-[13px] text-zinc-500' : ''}`}
                                        >
                                            {item.text}
                                        </a>
                                    ))}
                                </nav>
                            </div>
                        )}

                        {/* Featured Widget */}
                        <div className="bg-[#f8f9fa] rounded-2xl p-8 border border-zinc-100 relative overflow-hidden">
                            <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-secondary mb-6 flex items-center gap-3">
                                More Like This
                                <div className="flex-1 h-[1px] bg-zinc-200" />
                            </h4>
                            <div className="space-y-8">
                                {recentPosts.map((rPost) => (
                                    <Link href={`/blog/${rPost.id}`} key={rPost.id} className="flex gap-4 group">
                                        <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-zinc-200 shadow-sm">
                                            <Image
                                                src={rPost.image}
                                                alt={rPost.title}
                                                fill
                                                sizes="80px"
                                                className="object-cover transition-transform group-hover:scale-110"
                                            />
                                        </div>
                                        <div>
                                            <h5 className="text-[14px] font-bold text-primary leading-tight group-hover:text-secondary transition-colors mb-2 line-clamp-2">
                                                {rPost.title}
                                            </h5>
                                            <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">{rPost.date}</span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {/* Social Widget */}
                        <div className="bg-white rounded-2xl p-8 border border-zinc-100 shadow-xl shadow-zinc-100">
                            <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-secondary mb-6">Join the Community</h4>
                            <div className="grid grid-cols-1 gap-3">
                                {[
                                    { icon: Facebook, label: "Facebook", color: "#1877F2", href: social.facebook },
                                    { icon: Instagram, label: "Instagram", color: "#E4405F", href: social.instagram },
                                    { icon: Twitter, label: "X", color: "#000000", href: social.twitter },
                                ]
                                    .filter((item) => item.href)
                                    .map((item) => (
                                        <a
                                            key={item.label}
                                            href={item.href!}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 hover:bg-zinc-100 transition-all border border-transparent hover:border-zinc-200 group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm">
                                                    <item.icon size={16} style={{ color: item.color }} />
                                                </div>
                                                <span className="text-sm font-bold text-primary">{item.label}</span>
                                            </div>
                                        </a>
                                    ))}
                            </div>
                        </div>

                        {/* Newsletter Widget - FIXED CONTRAST */}
                        <div className="bg-secondary-light rounded-3xl p-8 text-primary relative overflow-hidden border border-orange-100/50">
                            <div className="relative z-10">
                                <h4 className="text-[18px] font-bold mb-4 uppercase tracking-[0.1em]">Ergo-Tips in your inbox</h4>
                                <p className="text-zinc-600 text-sm leading-relaxed mb-8">
                                    The science of pet care is evolving. Get our monthly digest of breed-specific ergonomics.
                                </p>
                                <div className="space-y-3">
                                    <input
                                        type="email"
                                        placeholder="Your email"
                                        className="w-full px-5 py-4 rounded-[3px] bg-white border border-orange-200/50 text-primary placeholder:text-zinc-400 text-[14px] outline-none focus:border-secondary shadow-sm"
                                    />
                                    <button className="w-full bg-secondary text-white py-4 rounded-[3px] font-bold uppercase tracking-widest text-sm hover:bg-secondary-dark transition-all shadow-lg shadow-orange-200/30">
                                        Subscribe
                                    </button>
                                </div>
                            </div>
                            <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/5 rounded-full -mr-16 -mt-16 blur-3xl" />
                        </div>

                    </aside>
                </div>
            </section>

            {/* Recommendations Section */}
            <section className="bg-[#f8f9fa] py-20 px-4 md:px-8 border-t border-zinc-100">
                <div className="max-w-[1200px] mx-auto text-center mb-16">
                    <h2 className="text-[32px] font-bold text-primary mb-4">Recommended for You</h2>
                    <div className="w-16 h-1 bg-secondary mx-auto rounded-full"></div>
                </div>

                <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
                    {recentPosts.slice(0, 3).map((rPost) => (
                        <article key={rPost.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-zinc-100 group">
                            <div className="aspect-[16/10] overflow-hidden relative">
                                <Image
                                    src={rPost.image}
                                    alt={rPost.title}
                                    fill
                                    sizes="(max-width: 768px) 100vw, 33vw"
                                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                                />
                                <div className="absolute top-4 left-4">
                                    <span className="bg-white/90 backdrop-blur-sm text-secondary text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-[3px]">
                                        {rPost.category}
                                    </span>
                                </div>
                            </div>
                            <div className="p-8">
                                <h3 className="text-[18px] font-bold text-primary leading-tight mb-4 hover:text-secondary transition-colors cursor-pointer">
                                    {rPost.title}
                                </h3>
                                <Link href={`/blog/${rPost.id}`} className="text-primary font-bold uppercase tracking-[0.1em] text-sm flex items-center gap-2 transition-colors hover:text-secondary">
                                    Read Story <ChevronRight size={14} />
                                </Link>
                            </div>
                        </article>
                    ))}
                </div>
            </section>

            <Footer />
        </main>
    );
}
