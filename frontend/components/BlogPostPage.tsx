"use client";

import React from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronRight,
    Check,
    Link2,
    User,
    Calendar,
    Clock,
    ArrowLeft,
    Facebook,
    Twitter,
    Instagram,
    Youtube,
    PawPrint,
    HeartHandshake
} from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import ComparisonTable, { ComparisonData } from '@/components/blog/ComparisonTable';
import { useSettings } from '@/context/SettingsContext';
import { withTableOfContents } from '@/lib/text';
import { getApiBaseUrl } from '@/lib/api';
import { fetchApi } from '@/lib/fetchApi';
import { formatDate } from '@/lib/date';
import { SITE_URL } from '@/lib/site';
import { TikTokIcon, PinterestIcon } from '@/lib/socialIcons';
import { sanitizeRichHtml } from '@/lib/sanitize-rich-html';

const fadeUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

interface BlogPost {
    id: number;
    slug: string;
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
    tags: { name: string; slug: string }[];
}

interface BlogPostPageProps {
    post: BlogPost;
    recentPosts: BlogPost[];
}

type Comment = {
    id: number;
    customer_name: string;
    comment: string;
    created_at: string;
};

export default function BlogPostPage({ post, recentPosts }: BlogPostPageProps) {
    const { social } = useSettings();
    const [isCommenting, setIsCommenting] = React.useState(false);
    const shareUrl = `${SITE_URL}/blog/${post.slug}`;
    const sanitizedContent = React.useMemo(
        () => sanitizeRichHtml(post.content || `<p>${post.excerpt}</p>`),
        [post.content, post.excerpt]
    );
    const { html: contentHtml, items: tocItems } = React.useMemo(
        () => withTableOfContents(sanitizedContent),
        [sanitizedContent]
    );

    const [comments, setComments] = React.useState<Comment[]>([]);
    const [commentsLoading, setCommentsLoading] = React.useState(true);
    const [commentName, setCommentName] = React.useState('');
    const [commentText, setCommentText] = React.useState('');
    const [submitting, setSubmitting] = React.useState(false);
    const [submitError, setSubmitError] = React.useState<string | null>(null);
    const [submitted, setSubmitted] = React.useState(false);

    const [linkCopied, setLinkCopied] = React.useState(false);
    const [tagsExpanded, setTagsExpanded] = React.useState(false);

    const handleCopyLink = () => {
        navigator.clipboard.writeText(shareUrl).then(() => {
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
        });
    };

    React.useEffect(() => {
        let cancelled = false;

        fetch(`${getApiBaseUrl()}/api/posts/${post.slug}/comments`)
            .then((res) => (res.ok ? res.json() : Promise.reject()))
            .then((data) => {
                if (!cancelled) setComments(Array.isArray(data?.comments) ? data.comments : []);
            })
            .catch(() => { })
            .finally(() => {
                if (!cancelled) setCommentsLoading(false);
            });

        return () => { cancelled = true; };
    }, [post.slug]);

    const handleCommentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setSubmitError(null);

        try {
            const res = await fetchApi(`/api/posts/${post.slug}/comments`, {
                method: 'POST',
                body: { customer_name: commentName, comment: commentText },
            });

            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.message || 'Could not submit your comment. Please try again.');
            }

            setSubmitted(true);
            setCommentName('');
            setCommentText('');
        } catch (err) {
            setSubmitError(err instanceof Error ? err.message : 'Could not submit your comment. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

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
                        <Link href="/blog" className="inline-flex items-center gap-2 text-rust font-bold uppercase tracking-widest text-sm mb-8 hover:translate-x-[-4px] transition-transform">
                            <ArrowLeft size={14} /> Back to Blog
                        </Link>

                        <div className="flex justify-center mb-6">
                            <span className="bg-secondary/10 text-rust text-xs font-bold uppercase tracking-[0.2em] px-4 py-2 rounded-[3px]">
                                {post.category}
                            </span>
                        </div>

                        <h1 className="text-[32px] md:text-[48px] lg:text-[56px] font-bold text-primary leading-[1.1] mb-8">
                            {post.title}
                        </h1>

                        <div className="flex flex-wrap items-center justify-center gap-6 text-zinc-500 text-xs font-medium">
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
                <div className="max-w-[1400px] mx-auto flex flex-col lg:flex-row gap-16">

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
                            className="prose prose-zinc max-w-none text-primary text-[17px] md:text-[18px] leading-[1.8] font-medium [&>p:first-of-type]:first-letter:text-5xl [&>p:first-of-type]:first-letter:font-bold [&>p:first-of-type]:first-letter:text-secondary [&>p:first-of-type]:first-letter:mr-3 [&>p:first-of-type]:first-letter:float-left [&>*+*]:mt-8 [&_h2]:text-[28px] [&_h2]:md:text-[32px] [&_h2]:font-bold [&_h2]:text-primary [&_h2]:mt-12 [&_h2]:mb-6 [&_blockquote]:border-l-4 [&_blockquote]:border-secondary [&_blockquote]:pl-8 [&_blockquote]:py-4 [&_blockquote]:bg-secondary-light [&_blockquote]:rounded-r-xl [&_blockquote]:italic [&_blockquote]:text-[22px] [&_blockquote]:text-primary [&_blockquote]:font-semibold [&_blockquote]:not-italic [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-2xl [&_table]:border [&_table]:border-zinc-200 [&_table]:my-8 [&_table]:text-[15px] [&_thead]:bg-secondary-light [&_th]:text-left [&_th]:text-[12px] [&_th]:font-bold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-primary [&_th]:px-5 [&_th]:py-3.5 [&_th]:border-b [&_th]:border-zinc-200 [&_td]:px-5 [&_td]:py-4 [&_td]:font-normal [&_td]:text-primary [&_td]:border-b [&_td]:border-zinc-100 [&_td]:align-top [&_tbody_tr:last-child_td]:border-b-0 [&_tbody_tr:hover]:bg-zinc-50"
                            dangerouslySetInnerHTML={{ __html: contentHtml }}
                        />

                        {/* Article Footer */}
                        <div className="mt-16 pt-10 border-t border-zinc-100">
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                                <div className="flex items-center gap-4">
                                    <span className="text-zinc-500 text-sm font-bold whitespace-nowrap">Share:</span>
                                    <div className="flex items-center gap-2">
                                        <a
                                            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            aria-label="Share on Facebook"
                                            className="w-10 h-10 rounded-full border border-zinc-100 flex items-center justify-center text-zinc-400 hover:border-secondary hover:text-rust transition-all bg-white shadow-sm"
                                        >
                                            <Facebook size={16} />
                                        </a>
                                        <a
                                            href={`https://pinterest.com/pin/create/button/?url=${encodeURIComponent(shareUrl)}&media=${encodeURIComponent(post.image)}&description=${encodeURIComponent(post.title)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            aria-label="Share on Pinterest"
                                            className="w-10 h-10 rounded-full border border-zinc-100 flex items-center justify-center text-zinc-400 hover:border-secondary hover:text-rust transition-all bg-white shadow-sm"
                                        >
                                            <PinterestIcon size={16} />
                                        </a>
                                        <button
                                            onClick={handleCopyLink}
                                            aria-label="Copy link"
                                            className="w-10 h-10 rounded-full border border-zinc-100 flex items-center justify-center text-zinc-400 hover:border-secondary hover:text-rust transition-all bg-white shadow-sm"
                                        >
                                            {linkCopied ? <Check size={16} className="text-success" /> : <Link2 size={16} />}
                                        </button>
                                        {linkCopied && (
                                            <span className="text-xs font-bold text-success">Link copied!</span>
                                        )}
                                    </div>
                                </div>
                                {post.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-2 md:justify-end">
                                        {(tagsExpanded ? post.tags : post.tags.slice(0, 5)).map(tag => (
                                            <span key={tag.slug} className="text-xs font-bold text-primary/60 border border-zinc-200 px-4 py-1.5 rounded-[3px] bg-white shadow-sm">
                                                {tag.name}
                                            </span>
                                        ))}
                                        {!tagsExpanded && post.tags.length > 5 && (
                                            <button
                                                onClick={() => setTagsExpanded(true)}
                                                className="text-xs font-bold text-zinc-400 border border-zinc-200 px-4 py-1.5 rounded-[3px] bg-white shadow-sm hover:text-rust hover:border-secondary transition-colors"
                                            >
                                                +{post.tags.length - 5} more
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Comments Section */}
                        <div className="mt-24 space-y-16">
                            <div className="flex items-center gap-4">
                                <h3 className="text-[24px] font-bold text-primary">Discussion</h3>
                                <div className="flex-1 h-[1px] bg-zinc-100" />
                                {!commentsLoading && (
                                    <span className="bg-zinc-50 text-zinc-400 px-3 py-1 rounded-full text-xs font-bold">{comments.length}</span>
                                )}
                            </div>

                            {!commentsLoading && comments.length === 0 && (
                                <p className="text-zinc-400 text-[15px]">No comments yet — be the first to share your thoughts.</p>
                            )}

                            {comments.length > 0 && (
                                <div className="space-y-10">
                                    {comments.map((c) => (
                                        <div key={c.id} className="flex gap-6">
                                            <div className="w-12 h-12 rounded-full bg-zinc-100 shrink-0 overflow-hidden border border-zinc-200 flex items-center justify-center">
                                                <User size={24} className="text-zinc-400" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between mb-2">
                                                    <h5 className="text-[14px] font-bold text-primary">{c.customer_name}</h5>
                                                    <span className="text-xs text-zinc-400">{formatDate(c.created_at)}</span>
                                                </div>
                                                <p className="text-[#666666] text-[15px] leading-relaxed">{c.comment}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Leave a Comment Form */}
                            <div className="space-y-8">
                                <button
                                    onClick={() => setIsCommenting(!isCommenting)}
                                    className="w-full flex items-center justify-center gap-3 py-4 border border-zinc-100 rounded-2xl hover:bg-zinc-50 hover:border-secondary/20 transition-all group"
                                >
                                    <h3 className="text-[16px] font-bold text-primary group-hover:text-rust">Leave a Comment</h3>
                                    <motion.div
                                        animate={{ rotate: isCommenting ? 180 : 0 }}
                                        className="text-rust"
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
                                                {submitted ? (
                                                    <p className="text-[14px] text-primary font-medium">
                                                        Thanks! Your comment has been submitted and will appear once it&apos;s reviewed.
                                                    </p>
                                                ) : (
                                                    <>
                                                        <div className="mb-6">
                                                            <h3 className="text-[16px] font-bold text-primary mb-1">Leave a Reply</h3>
                                                            <p className="text-zinc-500 text-[13px]">Comments are reviewed before they appear publicly. Required fields are marked *</p>
                                                        </div>
                                                        <form className="space-y-4" onSubmit={handleCommentSubmit}>
                                                            <div className="space-y-1.5">
                                                                <label className="text-xs font-bold text-primary uppercase tracking-wide ml-1">Name *</label>
                                                                <input
                                                                    type="text"
                                                                    required
                                                                    maxLength={255}
                                                                    value={commentName}
                                                                    onChange={(e) => setCommentName(e.target.value)}
                                                                    className="w-full px-4 py-3 rounded-[3px] bg-white border border-zinc-200 outline-none focus:border-secondary text-[14px]"
                                                                    placeholder="John Doe"
                                                                />
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                <label className="text-xs font-bold text-primary uppercase tracking-wide ml-1">Comment *</label>
                                                                <textarea
                                                                    rows={5}
                                                                    required
                                                                    maxLength={2000}
                                                                    value={commentText}
                                                                    onChange={(e) => setCommentText(e.target.value)}
                                                                    className="w-full px-4 py-3 rounded-[3px] bg-white border border-zinc-200 outline-none focus:border-secondary text-[14px] resize-none"
                                                                    placeholder="Your message here..."
                                                                />
                                                            </div>
                                                            {submitError && (
                                                                <p className="text-red-500 text-sm">{submitError}</p>
                                                            )}
                                                            <button
                                                                type="submit"
                                                                disabled={submitting}
                                                                className="bg-secondary text-ink px-8 py-3 rounded-[3px] font-bold uppercase tracking-[0.1em] text-sm hover:bg-secondary-dark disabled:opacity-50 transition-all shadow-lg shadow-orange-200/50"
                                                            >
                                                                {submitting ? 'Posting...' : 'Post Comment'}
                                                            </button>
                                                        </form>
                                                    </>
                                                )}
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
                                <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-rust mb-6 flex items-center gap-3">
                                    On This Page
                                    <div className="flex-1 h-[1px] bg-zinc-200" />
                                </h4>
                                <nav className="space-y-3">
                                    {tocItems.map((item) => (
                                        <a
                                            key={item.id}
                                            href={`#${item.id}`}
                                            className={`block text-[14px] font-medium text-primary hover:text-rust transition-colors ${item.level === 3 ? 'pl-4 text-[13px] text-zinc-500' : ''}`}
                                        >
                                            {item.text}
                                        </a>
                                    ))}
                                </nav>
                            </div>
                        )}

                        {/* Featured Widget */}
                        {recentPosts.length > 0 && (
                            <div className="bg-[#f8f9fa] rounded-2xl p-8 border border-zinc-100 relative overflow-hidden">
                                <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-rust mb-6 flex items-center gap-3">
                                    More Like This
                                    <div className="flex-1 h-[1px] bg-zinc-200" />
                                </h4>
                                <div className="space-y-8">
                                    {recentPosts.map((rPost) => (
                                        <Link href={`/blog/${rPost.slug}`} key={rPost.id} className="flex gap-4 group">
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
                                                <h5 className="text-[14px] font-bold text-primary leading-tight group-hover:text-rust transition-colors mb-2 line-clamp-2">
                                                    {rPost.title}
                                                </h5>
                                                <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">{rPost.date}</span>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Social Widget */}
                        <div className="bg-white rounded-2xl p-8 border border-zinc-100 shadow-xl shadow-zinc-100">
                            <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-rust mb-6">Join the Community</h4>
                            <div className="grid grid-cols-1 gap-3">
                                {[
                                    { icon: Facebook, label: "Facebook", color: "#1877F2", href: social.facebook },
                                    { icon: Instagram, label: "Instagram", color: "#E4405F", href: social.instagram },
                                    { icon: Twitter, label: "X", color: "#000000", href: social.twitter },
                                    { icon: TikTokIcon, label: "TikTok", color: "#000000", href: social.tiktok },
                                    { icon: PinterestIcon, label: "Pinterest", color: "#E60023", href: social.pinterest },
                                    { icon: Youtube, label: "YouTube", color: "#FF0000", href: social.youtube },
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

                    </aside>
                </div>
            </section>

            {/* Recommendations Section */}
            <section className="bg-[#f8f9fa] py-20 px-4 md:px-8 border-t border-zinc-100">
                <div className="max-w-[1400px] mx-auto text-center mb-16">
                    <h2 className="text-[32px] font-bold text-primary mb-4">
                        {recentPosts.length > 0 ? 'Recommended for You' : 'Explore More'}
                    </h2>
                    <div className="w-16 h-1 bg-secondary mx-auto rounded-full"></div>
                </div>

                {recentPosts.length > 0 ? (
                    <div className="max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
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
                                        <span className="bg-white/90 backdrop-blur-sm text-rust text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-[3px]">
                                            {rPost.category}
                                        </span>
                                    </div>
                                </div>
                                <div className="p-8">
                                    <h3 className="text-[18px] font-bold text-primary leading-tight mb-4 hover:text-rust transition-colors cursor-pointer">
                                        {rPost.title}
                                    </h3>
                                    <Link href={`/blog/${rPost.slug}`} className="text-secondary font-bold capitalize tracking-[0.05em] text-sm flex items-center gap-2 transition-colors hover:text-rust">
                                        Read Story <ChevronRight size={14} />
                                    </Link>
                                </div>
                            </article>
                        ))}
                    </div>
                ) : (
                    <div className="max-w-[800px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
                        <Link href="/dogs" className="bg-white rounded-2xl p-10 border border-zinc-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all group text-center">
                            <PawPrint size={32} className="text-secondary mx-auto mb-4" />
                            <h3 className="text-[20px] font-bold text-primary mb-2 group-hover:text-rust transition-colors">Explore by Breed</h3>
                            <p className="text-zinc-500 text-sm mb-6">Find products matched to your dog&apos;s body type and needs.</p>
                            <span className="text-primary font-bold uppercase tracking-[0.1em] text-sm inline-flex items-center gap-2 group-hover:text-rust transition-colors">
                                Browse Breeds <ChevronRight size={14} />
                            </span>
                        </Link>
                        <Link href="/solutions" className="bg-white rounded-2xl p-10 border border-zinc-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all group text-center">
                            <HeartHandshake size={32} className="text-secondary mx-auto mb-4" />
                            <h3 className="text-[20px] font-bold text-primary mb-2 group-hover:text-rust transition-colors">Explore by Need</h3>
                            <p className="text-zinc-500 text-sm mb-6">Feeding, comfort, mobility and walking — find what your dog needs.</p>
                            <span className="text-primary font-bold uppercase tracking-[0.1em] text-sm inline-flex items-center gap-2 group-hover:text-rust transition-colors">
                                Browse Needs <ChevronRight size={14} />
                            </span>
                        </Link>
                    </div>
                )}
            </section>

            <Footer />
        </main>
    );
}
