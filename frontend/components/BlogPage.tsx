"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, MessageSquare, Facebook, Twitter, Instagram, Youtube, Bookmark, Share2, User, ArrowRight } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';

const fadeUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

const CATEGORIES = [
    "All",
    "Ergonomics",
    "Health",
    "Breed Guides",
    "Lifestyle",
    "Product News"
];

const BLOG_POSTS = [
    {
        id: 1,
        category: "Ergonomics",
        title: "The Ultimate Guide to Pet Posture: Why Ergonomics Matter for Longevity",
        excerpt: "Discover how simple changes in your pet's environment can prevent long-term spinal issues and improve their overall quality of life.",
        image: "/assets/Corgi.png",
        author: "Dr. Sarah Miller",
        date: "March 24, 2024",
        readTime: "8 min read",
        isHero: true
    },
    {
        id: 2,
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
        category: "Health",
        title: "5 Signs Your Pet Is Struggling with Traditional Bowls",
        excerpt: "Signs like excessive splashing or hesitation before eating could mean your pet is in discomfort.",
        image: "/assets/Dog-Bowls-5.png",
        author: "James Wilson",
        date: "March 15, 2024",
        readTime: "7 min read"
    }
];

export default function BlogPage() {
    const [activeTab, setActiveTab] = useState("All");

    return (
        <main className="min-h-screen bg-white font-hanken overflow-x-hidden">
            <Header />

            {/* Hero Section - Featured Post */}
            <section className="bg-[#f8f9fa] pt-8 pb-16 px-4 md:px-8">
                <div className="max-w-[1200px] mx-auto">
                    <motion.div
                        initial="initial"
                        animate="animate"
                        variants={fadeUp}
                        className="flex flex-col lg:flex-row gap-0 lg:gap-10 bg-white rounded-2xl overflow-hidden shadow-sm border border-zinc-100"
                    >
                        <div className="lg:w-3/5 h-[300px] md:h-[450px] relative overflow-hidden group">
                            <img
                                src={BLOG_POSTS[0].image}
                                alt="Hero Post"
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                            />
                            <div className="absolute top-6 left-6">
                                <span className="bg-[#df8448] text-white text-[11px] font-bold uppercase tracking-[0.2em] px-4 py-2 rounded-[3px] shadow-lg">
                                    Featured Article
                                </span>
                            </div>
                        </div>
                        <div className="lg:w-2/5 p-8 md:p-12 flex flex-col justify-center">
                            <div className="flex items-center gap-3 mb-6">
                                <span className="text-[#df8448] text-[13px] font-bold tracking-widest uppercase">
                                    {BLOG_POSTS[0].category}
                                </span>
                                <span className="w-1 h-1 bg-zinc-300 rounded-full"></span>
                                <span className="text-zinc-400 text-[13px]">{BLOG_POSTS[0].date}</span>
                            </div>
                            <h1 className="text-[28px] md:text-[36px] font-bold text-[#3e4c57] leading-tight mb-6 hover:text-[#df8448] transition-colors cursor-pointer">
                                {BLOG_POSTS[0].title}
                            </h1>
                            <p className="text-[#666666] text-[16px] leading-relaxed mb-8 line-clamp-3">
                                {BLOG_POSTS[0].excerpt}
                            </p>
                            <div className="flex items-center justify-between mt-auto pt-6 border-t border-zinc-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center border border-zinc-200 overflow-hidden">
                                        <User size={20} className="text-zinc-400" />
                                    </div>
                                    <div>
                                        <span className="block text-[14px] font-bold text-[#3e4c57]">{BLOG_POSTS[0].author}</span>
                                        <span className="block text-[12px] text-zinc-400">{BLOG_POSTS[0].readTime}</span>
                                    </div>
                                </div>
                                <button className="text-[#3e4c57] hover:text-[#df8448] transition-all flex items-center gap-2 font-bold uppercase tracking-widest text-[11px]">
                                    Continue <ArrowRight size={14} />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Category Navigation */}
            <nav className="border-y border-zinc-100 bg-white sticky top-[65px] md:top-[100px] z-40">
                <div className="max-w-[1200px] mx-auto px-4 md:px-8 overflow-x-auto no-scrollbar">
                    <div className="flex items-center gap-8 py-5 whitespace-nowrap">
                        {CATEGORIES.map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setActiveTab(cat)}
                                className={`text-[12px] md:text-[13px] font-bold uppercase tracking-[0.15em] transition-all relative py-2 ${activeTab === cat ? 'text-[#df8448]' : 'text-[#3e4c57]/60 hover:text-[#3e4c57]'
                                    }`}
                            >
                                {cat}
                                {activeTab === cat && (
                                    <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#df8448]" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </nav>

            {/* Main Content Grid */}
            <section className="py-16 px-4 md:px-8">
                <div className="max-w-[1200px] mx-auto flex flex-col lg:flex-row gap-16">

                    {/* Main Posts Feed */}
                    <div className="flex-1">
                        <h2 className="text-[20px] font-bold text-[#3e4c57] uppercase tracking-[0.2em] mb-10 flex items-center gap-4">
                            Latest Stories
                            <div className="flex-1 h-[1px] bg-zinc-100" />
                        </h2>
                        <div className="space-y-12 md:space-y-16">
                            {BLOG_POSTS.slice(1).map((post) => (
                                <article key={post.id} className="flex flex-col md:flex-row gap-8 group">
                                    <div className="md:w-[35%] aspect-[4/3] rounded-xl overflow-hidden relative shadow-sm shrink-0">
                                        <img
                                            src={post.image}
                                            alt={post.title}
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        />
                                        <div className="absolute top-4 left-4">
                                            <span className="bg-white/90 backdrop-blur-sm text-[#df8448] text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-[3px] shadow-sm">
                                                {post.category}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex-1 flex flex-col py-1">
                                        <div className="flex items-center gap-3 text-zinc-400 text-[11px] mb-3 uppercase tracking-wider font-bold">
                                            <span className="text-[#df8448]">{post.author}</span>
                                            <span className="w-1 h-1 bg-zinc-200 rounded-full"></span>
                                            <span>{post.date}</span>
                                        </div>
                                        <h3 className="text-[22px] md:text-[26px] font-bold text-[#3e4c57] leading-tight mb-4 hover:text-[#df8448] transition-colors cursor-pointer line-clamp-2">
                                            {post.title}
                                        </h3>
                                        <p className="text-[#666666] text-[15px] leading-relaxed mb-6 line-clamp-3">
                                            {post.excerpt}
                                        </p>
                                        <div className="mt-auto flex items-center justify-between pt-5 border-t border-zinc-50">
                                            <div className="flex items-center gap-6">
                                                <button className="flex items-center gap-1.5 text-zinc-400 hover:text-[#df8448] transition-colors text-[12px] font-medium">
                                                    <Share2 size={14} /> Share
                                                </button>
                                                <button className="flex items-center gap-1.5 text-zinc-400 hover:text-[#df8448] transition-colors text-[12px] font-medium">
                                                    <MessageSquare size={14} /> 12
                                                </button>
                                            </div>
                                            <Link href={`/blog/${post.id}`} className="text-[#3e4c57] hover:text-[#df8448] transition-all font-bold uppercase tracking-[0.2em] text-[10px] flex items-center gap-2">
                                                Read Story <ChevronRight size={14} />
                                            </Link>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>

                        <div className="mt-20 pt-10 border-t border-zinc-100 flex justify-center">
                            <button className="bg-[#df8448] text-white px-14 py-4 rounded-[3px] font-bold uppercase tracking-[0.2em] text-[11px] hover:bg-[#c9713a] transition-all shadow-xl shadow-orange-100/50">
                                Load More Content
                            </button>
                        </div>
                    </div>

                    {/* Sidebar */}
                    <aside className="lg:w-80 space-y-12">

                        {/* Follow Us Section */}
                        <div className="bg-white rounded-2xl p-8 border border-zinc-100 shadow-sm">
                            <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#df8448] mb-6 flex items-center gap-3">
                                Follow PetPosture
                                <div className="w-1.5 h-1.5 bg-[#df8448]/20 rounded-full" />
                            </h4>
                            <div className="grid grid-cols-1 gap-3">
                                {[
                                    { icon: Facebook, label: "Facebook", count: "12K", color: "#1877F2" },
                                    { icon: Instagram, label: "Instagram", count: "25K", color: "#E4405F" },
                                    { icon: Twitter, label: "Twitter (X)", count: "8K", color: "#000000" },
                                    { icon: Youtube, label: "Youtube", count: "15K", color: "#FF0000" }
                                ].map((social) => (
                                    <button key={social.label} className="flex items-center justify-between p-3.5 rounded-xl bg-[#f8f9fa] hover:bg-zinc-100 transition-all border border-zinc-100/50 group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white shadow-sm border border-zinc-100 group-hover:border-[#df8448]/30 transition-colors">
                                                <social.icon size={16} style={{ color: social.color }} />
                                            </div>
                                            <span className="text-[13px] font-bold text-[#3e4c57]">{social.label}</span>
                                        </div>
                                        <span className="text-[11px] font-bold text-zinc-400">{social.count}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Trending Section */}
                        <div>
                            <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#df8448] mb-8 flex items-center gap-3">
                                Most Discussed
                                <div className="flex-1 h-[1px] bg-zinc-100" />
                            </h4>
                            <div className="space-y-7">
                                <div className="relative rounded-xl overflow-hidden aspect-[16/10] group cursor-pointer shadow-sm">
                                    <img
                                        src={BLOG_POSTS[1].image}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                        alt="Trending"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#3e4c57]/90 via-[#3e4c57]/20 to-transparent flex flex-col justify-end p-5">
                                        <span className="bg-[#df8448] text-white text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-[2px] w-fit mb-2">Editor's Pick</span>
                                        <h5 className="text-white text-[15px] font-bold leading-tight group-hover:text-[#df8448] transition-colors line-clamp-2">
                                            {BLOG_POSTS[1].title}
                                        </h5>
                                    </div>
                                </div>
                                {[3, 4, 5].map((id) => {
                                    const post = BLOG_POSTS.find(p => p.id === id);
                                    return (
                                        <div key={id} className="flex gap-4 group cursor-pointer">
                                            <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 shadow-sm border border-zinc-100">
                                                <img src={post?.image} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt="Thumb" />
                                            </div>
                                            <div className="flex-1">
                                                <h6 className="text-[13px] font-bold text-[#3e4c57] leading-snug group-hover:text-[#df8448] transition-colors mb-1 line-clamp-2">
                                                    {post?.title}
                                                </h6>
                                                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">{post?.date}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Newsletter Mini Card */}
                        <div className="bg-[#f8f9fa] rounded-2xl p-8 border border-zinc-100 relative overflow-hidden">
                            <h4 className="text-[14px] font-bold text-[#3e4c57] mb-4 uppercase tracking-[0.1em]">Never miss a post</h4>
                            <p className="text-[13px] text-[#666666] mb-6">Join 5,000+ pet parents getting our weekly ergonomics report.</p>
                            <input
                                type="email"
                                placeholder="Your email"
                                className="w-full px-4 py-3 rounded-[3px] border border-zinc-200 mb-4 outline-none focus:border-[#df8448] text-[13px]"
                            />
                            <button className="w-full bg-[#df8448] text-white py-3 rounded-[3px] font-bold uppercase tracking-[0.15em] text-[11px] hover:bg-[#c9713a] transition-all">
                                Subscribe
                            </button>
                        </div>

                        {/* Quote Banner */}
                        <div className="bg-[#f8f9fa] rounded-2xl p-8 text-[#3e4c57] text-center border border-zinc-100 relative overflow-hidden">
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                                <Bookmark className="text-[#df8448]" size={20} />
                            </div>
                            <p className="text-[15px] font-bold italic leading-relaxed relative z-10">
                                "A dog doesn't need much, but they deserve to be comfortable while they wait for you."
                            </p>
                            <div className="absolute top-0 right-0 w-24 h-24 bg-[#df8448]/5 rounded-full -mr-12 -mt-12" />
                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-[#3e4c57]/5 rounded-full -ml-12 -mb-12" />
                        </div>

                    </aside>
                </div>
            </section>

            {/* Main Newsletter Section */}
            <section className="bg-white py-12 px-4 md:px-8 border-t border-zinc-50">
                <div className="max-w-[1000px] mx-auto bg-[#3e4c57] rounded-2xl p-8 md:p-14 text-center relative overflow-hidden shadow-xl">
                    <motion.div initial="initial" whileInView="animate" viewport={{ once: true }} variants={fadeUp} className="relative z-10">
                        <h2 className="text-[32px] md:text-[36px] font-bold text-white mb-4 tracking-tight">Stay Inside The Loop</h2>
                        <p className="text-white/70 text-[15px] md:text-[16px] mb-8 max-w-lg mx-auto leading-relaxed">
                            Get the latest pet ergonomics news, breed-specific guides, and exclusive collection previews delivered to your inbox.
                        </p>
                        <div className="flex flex-col md:flex-row gap-3 max-w-xl mx-auto">
                            <input
                                type="email"
                                placeholder="Enter your email address"
                                className="flex-1 px-6 py-4 rounded-[3px] bg-white text-[#3e4c57] outline-none text-[14px] font-medium"
                            />
                            <button className="bg-[#df8448] text-white px-10 py-4 rounded-[3px] font-bold uppercase tracking-[0.2em] text-[11px] hover:bg-[#c9713a] transition-all whitespace-nowrap shadow-lg">
                                Subscribe Now
                            </button>
                        </div>
                        <p className="mt-6 text-white/30 text-[10px] uppercase tracking-widest font-bold">
                            By subscribing, you agree to our privacy policy and terms.
                        </p>
                    </motion.div>
                    {/* Decorative Elements */}
                    <div className="absolute top-0 left-0 w-48 h-48 bg-[#df8448]/10 rounded-full blur-[80px] -ml-24 -mt-24" />
                    <div className="absolute bottom-0 right-0 w-48 h-48 bg-white/5 rounded-full blur-[80px] -mr-24 -mb-24" />
                </div>
            </section>

            <Footer />
        </main>
    );
}
