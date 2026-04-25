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
    image: string;
    author: string;
    date: string;
    readTime: string;
}

interface BlogPostPageProps {
    post: BlogPost;
    recentPosts: BlogPost[];
}

export default function BlogPostPage({ post, recentPosts }: BlogPostPageProps) {
    const [isCommenting, setIsCommenting] = React.useState(false);

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
                        <Link href="/blog" className="inline-flex items-center gap-2 text-[#df8448] font-bold uppercase tracking-widest text-[11px] mb-8 hover:translate-x-[-4px] transition-transform">
                            <ArrowLeft size={14} /> Back to Blog
                        </Link>

                        <div className="flex justify-center mb-6">
                            <span className="bg-[#df8448]/10 text-[#df8448] text-[11px] font-bold uppercase tracking-[0.2em] px-4 py-2 rounded-[3px]">
                                {post.category}
                            </span>
                        </div>

                        <h1 className="text-[32px] md:text-[48px] lg:text-[56px] font-bold text-[#3e4c57] leading-[1.1] mb-8">
                            {post.title}
                        </h1>

                        <div className="flex flex-wrap items-center justify-center gap-6 text-zinc-400 text-[13px] font-medium">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center overflow-hidden border border-zinc-300">
                                    <User size={16} className="text-zinc-500" />
                                </div>
                                <span className="text-[#3e4c57] font-bold">{post.author}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Calendar size={14} className="text-[#df8448]" />
                                <span>{post.date}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock size={14} className="text-[#df8448]" />
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
                                    alt={post.title}
                                    fill
                                    sizes="(max-width: 1024px) 100vw, 70vw"
                                    className="object-cover"
                                />
                            </div>
                        </motion.div>

                        <article className="prose prose-zinc max-w-none">
                            <div className="text-[#3e4c57] text-[18px] md:text-[20px] leading-[1.8] space-y-8 font-medium">
                                <p className="first-letter:text-5xl first-letter:font-bold first-letter:text-[#df8448] first-letter:mr-3 first-letter:float-left">
                                    {post.excerpt}
                                </p>

                                <p>
                                    As pet owners, we often overlook the long-term impact of daily physical activities. Simple motions like jumping off a couch, leaning down to reach a bowl, or sleeping on an unsupportive surface can accumulate stress on a pet&apos;s skeletal structure over time. This is especially true for specific breeds like Dachshunds, Pugs, and senior pets of all sizes.
                                </p>

                                <h2 className="text-[28px] md:text-[32px] font-bold text-[#3e4c57] mt-12 mb-6">The Science Behind the Slump</h2>

                                <p>
                                    Modern veterinary ergonomic research suggests that a &quot;neutral spine&quot; position is critical for digestive health and joint longevity. When a pet eats from a bowl placed too low, they must arch their neck and compress their chest, which can lead to air swallowing (aerophagia) and unnecessary strain on the cervical vertebrae.
                                </p>

                                <blockquote className="border-l-4 border-[#df8448] pl-8 py-4 my-10 bg-[#fdf2ea] rounded-r-xl italic text-[22px] text-[#3e4c57] font-semibold">
                                    &quot;Prevention is always more effective—and less painful—than correction when it comes to spinal health.&quot;
                                </blockquote>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 my-12">
                                    <div className="bg-[#f8f9fa] p-8 rounded-2xl border border-zinc-100">
                                        <h3 className="text-[18px] font-bold text-[#df8448] mb-4 uppercase tracking-widest">The Risk</h3>
                                        <p className="text-[16px] text-zinc-600">Standard bowls and beds don&apos;t account for natural anatomical angles, leading to premature aging and joint inflammation.</p>
                                    </div>
                                    <div className="bg-[#3e4c57] p-8 rounded-2xl text-white">
                                        <h3 className="text-[18px] font-bold text-[#df8448] mb-4 uppercase tracking-widest">The Solution</h3>
                                        <p className="text-[16px] text-white/80">Raised, tilted feeding systems and orthopedic memory foam provide the alignment needed for a pain-free life.</p>
                                    </div>
                                </div>

                                <p>
                                    By incorporating ergonomic tools into your pet&apos;s life today, you&apos;re not just buying gear; you&apos;re investing in years of mobility and comfort. At PetPosture, our mission is to make these scientific benefits accessible without compromising the aesthetic of your home.
                                </p>
                            </div>
                        </article>

                        {/* Article Footer */}
                        <div className="mt-16 pt-10 border-t border-zinc-100">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="flex items-center gap-4">
                                    <span className="text-zinc-400 text-[13px] font-bold uppercase tracking-wider">Share this story:</span>
                                    <div className="flex items-center gap-2">
                                        {[
                                            { icon: Facebook, color: "#1877F2" },
                                            { icon: Twitter, color: "#000000" },
                                            { icon: Share2, color: "#df8448" }
                                        ].map((soc, i) => (
                                            <button key={i} className="w-10 h-10 rounded-full border border-zinc-100 flex items-center justify-center text-zinc-400 hover:border-[#df8448] hover:text-[#df8448] transition-all bg-white shadow-sm">
                                                <soc.icon size={16} />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {["Health", "Guideline", "Senior Pets"].map(tag => (
                                        <span key={tag} className="text-[11px] font-bold text-[#3e4c57]/60 border border-zinc-200 px-4 py-1.5 rounded-[3px] hover:bg-zinc-50 cursor-pointer transition-colors bg-white shadow-sm uppercase tracking-widest">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Comments Section */}
                        <div className="mt-24 space-y-16">
                            <div className="flex items-center gap-4">
                                <h3 className="text-[24px] font-bold text-[#3e4c57]">Reader Comments</h3>
                                <div className="flex-1 h-[1px] bg-zinc-100" />
                                <span className="bg-zinc-50 text-zinc-400 px-3 py-1 rounded-full text-[12px] font-bold">2</span>
                            </div>

                            <div className="space-y-10">
                                <div className="flex gap-6">
                                    <div className="w-12 h-12 rounded-full bg-zinc-100 shrink-0 overflow-hidden border border-zinc-200 flex items-center justify-center">
                                        <User size={24} className="text-zinc-400" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-2">
                                            <h5 className="text-[14px] font-bold text-[#3e4c57]">Michael Chen</h5>
                                            <span className="text-[11px] text-zinc-400">Mar 25, 2024</span>
                                        </div>
                                        <p className="text-[#666666] text-[15px] leading-relaxed">
                                            This is exactly the information I was looking for! My Dachshund has been showing some signs of discomfort during meals, and I&apos;ll definitely look into a tilted bowl.
                                        </p>
                                        <button className="mt-4 text-[11px] font-bold text-[#df8448] uppercase tracking-widest hover:text-[#3e4c57] transition-colors">Reply</button>
                                    </div>
                                </div>
                            </div>

                            {/* Leave a Comment Form */}
                            <div className="space-y-8">
                                <button
                                    onClick={() => setIsCommenting(!isCommenting)}
                                    className="w-full flex items-center justify-center gap-4 py-4 border-2 border-zinc-100 rounded-2xl hover:bg-zinc-50 hover:border-[#df8448]/20 transition-all group"
                                >
                                    <h3 className="text-[20px] font-bold text-[#3e4c57] uppercase tracking-tighter group-hover:text-[#df8448]">Leave a Comment</h3>
                                    <motion.div
                                        animate={{ rotate: isCommenting ? 180 : 0 }}
                                        className="text-[#df8448]"
                                    >
                                        <ChevronRight size={24} className="rotate-90" />
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
                                            <div className="bg-[#f8f9fa] rounded-3xl p-10 border border-zinc-100">
                                                <div className="mb-10">
                                                    <h3 className="text-[20px] font-bold text-[#3e4c57] mb-2 uppercase tracking-tight">Leave a Reply</h3>
                                                    <p className="text-zinc-500 text-[14px]">Your email address will not be published. Required fields are marked *</p>
                                                </div>
                                                <form className="space-y-6">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        <div className="space-y-2">
                                                            <label className="text-[11px] font-bold text-[#3e4c57] uppercase tracking-widest ml-1">Name *</label>
                                                            <input type="text" className="w-full px-5 py-4 rounded-[3px] bg-white border border-zinc-200 outline-none focus:border-[#df8448] text-[14px]" placeholder="John Doe" />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-[11px] font-bold text-[#3e4c57] uppercase tracking-widest ml-1">Email *</label>
                                                            <input type="email" className="w-full px-5 py-4 rounded-[3px] bg-white border border-zinc-200 outline-none focus:border-[#df8448] text-[14px]" placeholder="john@example.com" />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[11px] font-bold text-[#3e4c57] uppercase tracking-widest ml-1">Website</label>
                                                        <input type="text" className="w-full px-5 py-4 rounded-[3px] bg-white border border-zinc-200 outline-none focus:border-[#df8448] text-[14px]" placeholder="Optional" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[11px] font-bold text-[#3e4c57] uppercase tracking-widest ml-1">Comment *</label>
                                                        <textarea rows={6} className="w-full px-5 py-4 rounded-[3px] bg-white border border-zinc-200 outline-none focus:border-[#df8448] text-[14px] resize-none" placeholder="Your message here..." />
                                                    </div>
                                                    <div className="flex items-center gap-3 py-4">
                                                        <input type="checkbox" id="save-info" className="w-4 h-4 rounded border-zinc-300 text-[#df8448] focus:ring-[#df8448]" />
                                                        <label htmlFor="save-info" className="text-[13px] text-zinc-500">Save my name, email, and website in this browser for the next time I comment.</label>
                                                    </div>
                                                    <button className="bg-[#df8448] text-white px-10 py-4 rounded-[3px] font-bold uppercase tracking-[0.2em] text-[11px] hover:bg-[#c9713a] transition-all shadow-lg shadow-orange-200/50">
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

                        {/* Featured Widget */}
                        <div className="bg-[#f8f9fa] rounded-2xl p-8 border border-zinc-100 relative overflow-hidden">
                            <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#df8448] mb-6 flex items-center gap-3">
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
                                            <h5 className="text-[14px] font-bold text-[#3e4c57] leading-tight group-hover:text-[#df8448] transition-colors mb-2 line-clamp-2">
                                                {rPost.title}
                                            </h5>
                                            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">{rPost.date}</span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {/* Social Widget */}
                        <div className="bg-white rounded-2xl p-8 border border-zinc-100 shadow-xl shadow-zinc-100">
                            <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#df8448] mb-6">Join the Community</h4>
                            <div className="grid grid-cols-1 gap-3">
                                {[
                                    { icon: Facebook, label: "Facebook", count: "12K", color: "#1877F2" },
                                    { icon: Instagram, label: "Instagram", count: "25K", color: "#E4405F" },
                                    { icon: Twitter, label: "X", count: "8K", color: "#000000" }
                                ].map((social) => (
                                    <button key={social.label} className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 hover:bg-zinc-100 transition-all border border-transparent hover:border-zinc-200 group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm">
                                                <social.icon size={16} style={{ color: social.color }} />
                                            </div>
                                            <span className="text-[13px] font-bold text-[#3e4c57]">{social.label}</span>
                                        </div>
                                        <span className="text-[11px] font-bold text-zinc-400">{social.count}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Newsletter Widget - FIXED CONTRAST */}
                        <div className="bg-[#fdf2ea] rounded-3xl p-8 text-[#3e4c57] relative overflow-hidden border border-orange-100/50">
                            <div className="relative z-10">
                                <h4 className="text-[18px] font-bold mb-4 uppercase tracking-[0.1em]">Ergo-Tips in your inbox</h4>
                                <p className="text-zinc-600 text-[13px] leading-relaxed mb-8">
                                    The science of pet care is evolving. Get our monthly digest of breed-specific ergonomics.
                                </p>
                                <div className="space-y-3">
                                    <input
                                        type="email"
                                        placeholder="Your email"
                                        className="w-full px-5 py-4 rounded-[3px] bg-white border border-orange-200/50 text-[#3e4c57] placeholder:text-zinc-400 text-[14px] outline-none focus:border-[#df8448] shadow-sm"
                                    />
                                    <button className="w-full bg-[#df8448] text-white py-4 rounded-[3px] font-bold uppercase tracking-widest text-[11px] hover:bg-[#c9713a] transition-all shadow-lg shadow-orange-200/30">
                                        Subscribe
                                    </button>
                                </div>
                            </div>
                            <div className="absolute top-0 right-0 w-32 h-32 bg-[#df8448]/5 rounded-full -mr-16 -mt-16 blur-3xl" />
                        </div>

                    </aside>
                </div>
            </section>

            {/* Recommendations Section */}
            <section className="bg-[#f8f9fa] py-20 px-4 md:px-8 border-t border-zinc-100">
                <div className="max-w-[1200px] mx-auto text-center mb-16">
                    <h2 className="text-[32px] font-bold text-[#3e4c57] mb-4">Recommended for You</h2>
                    <div className="w-16 h-1 bg-[#df8448] mx-auto rounded-full"></div>
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
                                    <span className="bg-white/90 backdrop-blur-sm text-[#df8448] text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-[3px]">
                                        {rPost.category}
                                    </span>
                                </div>
                            </div>
                            <div className="p-8">
                                <h3 className="text-[18px] font-bold text-[#3e4c57] leading-tight mb-4 hover:text-[#df8448] transition-colors cursor-pointer">
                                    {rPost.title}
                                </h3>
                                <Link href={`/blog/${rPost.id}`} className="text-[#3e4c57] font-bold uppercase tracking-widest text-[10px] flex items-center gap-2">
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
