"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
    ArrowRight,
    BookOpen,
    Bookmark,
    ChevronRight,
    Facebook,
    Instagram,
    Loader2,
    MessageSquare,
    Share2,
    Twitter,
    User,
    Youtube,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getApiBaseUrl } from "@/lib/api";

type BlogCategory = {
    id: string;
    name: string;
    slug: string;
};

type BlogPost = {
    id: string;
    slug: string;
    title: string;
    content: string;
    featured_image?: string | null;
    author?: string | null;
    read_time?: string | null;
    created_at?: string | null;
    blog_category?: BlogCategory | null;
};

type PostsResponse = {
    data?: BlogPost[];
};

type CategoriesResponse = {
    data?: BlogCategory[];
};

const fadeUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

export default function BlogPage() {
    const [activeTab, setActiveTab] = useState("All");
    const [posts, setPosts] = useState<BlogPost[]>([]);
    const [categories, setCategories] = useState<BlogCategory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const apiBase = getApiBaseUrl();
                const [postsRes, catsRes] = await Promise.all([
                    fetch(`${apiBase}/api/posts`),
                    fetch(`${apiBase}/api/blog/categories`),
                ]);

                if (!postsRes.ok || !catsRes.ok) {
                    throw new Error("Data sync failed");
                }

                const [postsData, catsData] = (await Promise.all([
                    postsRes.json(),
                    catsRes.json(),
                ])) as [PostsResponse, CategoriesResponse];

                setPosts(Array.isArray(postsData.data) ? postsData.data : []);
                setCategories(Array.isArray(catsData.data) ? catsData.data : []);
            } catch {
                setError("We are currently updating our stories. Please check back shortly.");
            } finally {
                setIsLoading(false);
            }
        };

        void fetchData();
    }, []);

    const filteredPosts =
        activeTab === "All"
            ? posts
            : posts.filter((post) => post.blog_category?.name === activeTab);

    const featuredPost = posts.length > 0 ? posts[0] : null;
    const latestPosts =
        posts.length > 1 && featuredPost
            ? filteredPosts.filter((post) => post.id !== featuredPost.id)
            : filteredPosts;

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-white font-hanken">
                <div className="text-center">
                    <Loader2 className="mx-auto mb-6 animate-spin text-[#df8448]" size={48} />
                    <p className="text-[12px] font-bold uppercase tracking-widest text-[#3e4c57]">
                        Curating your feed...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <main className="min-h-screen overflow-x-hidden bg-white font-hanken">
            <Header />

            {featuredPost && (
                <section className="bg-[#f8f9fa] px-4 pb-16 pt-8 md:px-8">
                    <div className="mx-auto max-w-[1200px]">
                        <motion.div
                            initial="initial"
                            animate="animate"
                            variants={fadeUp}
                            className="flex flex-col gap-0 overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm lg:flex-row lg:gap-10"
                        >
                            <div className="group relative h-[300px] overflow-hidden md:h-[450px] lg:w-3/5">
                                <Image
                                    src={featuredPost.featured_image || "/assets/placeholder-post.jpg"}
                                    alt={featuredPost.title}
                                    fill
                                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                                    sizes="(max-width: 1024px) 100vw, 60vw"
                                />
                                <div className="absolute left-6 top-6">
                                    <span className="rounded-[3px] bg-[#df8448] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-white shadow-lg">
                                        Featured Article
                                    </span>
                                </div>
                            </div>
                            <div className="flex flex-col justify-center p-8 md:p-12 lg:w-2/5">
                                <div className="mb-6 flex items-center gap-3">
                                    <span className="text-[13px] font-bold uppercase tracking-widest text-[#df8448]">
                                        {featuredPost.blog_category?.name || "Insights"}
                                    </span>
                                    <span className="h-1 w-1 rounded-full bg-zinc-300" />
                                    <span className="text-[13px] text-zinc-400">
                                        {featuredPost.created_at
                                            ? new Date(featuredPost.created_at).toLocaleDateString("en-US", {
                                                  month: "long",
                                                  day: "numeric",
                                                  year: "numeric",
                                              })
                                            : "Recently published"}
                                    </span>
                                </div>
                                <h1 className="mb-6 cursor-pointer text-[28px] font-bold leading-tight text-[#3e4c57] transition-colors hover:text-[#df8448] md:text-[36px]">
                                    {featuredPost.title}
                                </h1>
                                <p className="mb-8 line-clamp-3 text-[16px] leading-relaxed text-[#666666]">
                                    {featuredPost.content.substring(0, 160)}...
                                </p>
                                <div className="mt-auto flex items-center justify-between border-t border-zinc-100 pt-6">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-zinc-200 bg-zinc-100">
                                            <User size={20} className="text-zinc-400" />
                                        </div>
                                        <div>
                                            <span className="block text-[14px] font-bold text-[#3e4c57]">
                                                {featuredPost.author || "PetPosture Editorial"}
                                            </span>
                                            <span className="block text-[12px] text-zinc-400">
                                                {featuredPost.read_time || "5 min read"}
                                            </span>
                                        </div>
                                    </div>
                                    <Link
                                        href={`/blog/${featuredPost.slug || featuredPost.id}`}
                                        className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[#3e4c57] transition-all hover:text-[#df8448]"
                                    >
                                        Continue <ArrowRight size={14} />
                                    </Link>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </section>
            )}

            <nav className="sticky top-[65px] z-40 border-y border-zinc-100 bg-white md:top-[100px]">
                <div className="mx-auto max-w-[1200px] overflow-x-auto px-4 no-scrollbar md:px-8">
                    <div className="flex items-center gap-8 whitespace-nowrap py-5">
                        <button
                            onClick={() => setActiveTab("All")}
                            className={`relative py-2 text-[12px] font-bold uppercase tracking-[0.15em] transition-all md:text-[13px] ${
                                activeTab === "All"
                                    ? "text-[#df8448]"
                                    : "text-[#3e4c57]/60 hover:text-[#3e4c57]"
                            }`}
                        >
                            All
                            {activeTab === "All" && (
                                <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#df8448]" />
                            )}
                        </button>
                        {categories.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => setActiveTab(cat.name)}
                                className={`relative py-2 text-[12px] font-bold uppercase tracking-[0.15em] transition-all md:text-[13px] ${
                                    activeTab === cat.name
                                        ? "text-[#df8448]"
                                        : "text-[#3e4c57]/60 hover:text-[#3e4c57]"
                                }`}
                            >
                                {cat.name}
                                {activeTab === cat.name && (
                                    <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#df8448]" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </nav>

            <section className="px-4 py-16 md:px-8">
                <div className="mx-auto flex max-w-[1200px] flex-col gap-16 lg:flex-row">
                    <div className="flex-1">
                        <h2 className="mb-10 flex items-center gap-4 text-[20px] font-bold uppercase tracking-[0.2em] text-[#3e4c57]">
                            Latest Stories
                            <div className="h-[1px] flex-1 bg-zinc-100" />
                        </h2>

                        {error && (
                            <div className="mb-8 rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-[13px] font-medium text-amber-700">
                                {error}
                            </div>
                        )}

                        <div className="space-y-12 md:space-y-16">
                            {latestPosts.length === 0 ? (
                                <div className="rounded-2xl border border-zinc-100 bg-[#f8f9fa] py-20 text-center">
                                    <BookOpen size={40} className="mx-auto mb-4 text-zinc-200" />
                                    <p className="font-bold text-[#3e4c57]">No stories found in this section.</p>
                                </div>
                            ) : (
                                latestPosts.map((post) => (
                                    <article key={post.id} className="group flex flex-col gap-8 md:flex-row">
                                        <div className="relative aspect-[4/3] shrink-0 overflow-hidden rounded-xl shadow-sm md:w-[35%]">
                                            <Image
                                                src={post.featured_image || "/assets/placeholder-post.jpg"}
                                                alt={post.title}
                                                fill
                                                className="object-cover transition-transform duration-500 group-hover:scale-105"
                                                sizes="(max-width: 768px) 100vw, 35vw"
                                            />
                                            <div className="absolute left-4 top-4">
                                                <span className="rounded-[3px] bg-white/90 px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-[#df8448] shadow-sm backdrop-blur-sm">
                                                    {post.blog_category?.name || "Insights"}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex flex-1 flex-col py-1">
                                            <div className="mb-3 flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                                                <span className="text-[#df8448]">
                                                    {post.author || "PetPosture Editorial"}
                                                </span>
                                                <span className="h-1 w-1 rounded-full bg-zinc-200" />
                                                <span>
                                                    {post.created_at
                                                        ? new Date(post.created_at).toLocaleDateString()
                                                        : "Recently published"}
                                                </span>
                                            </div>
                                            <h3 className="mb-4 line-clamp-2 cursor-pointer text-[22px] font-bold leading-tight text-[#3e4c57] transition-colors hover:text-[#df8448] md:text-[26px]">
                                                {post.title}
                                            </h3>
                                            <p className="mb-6 line-clamp-3 text-[15px] leading-relaxed text-[#666666]">
                                                {post.content.substring(0, 140)}...
                                            </p>
                                            <div className="mt-auto flex items-center justify-between border-t border-zinc-50 pt-5">
                                                <div className="flex items-center gap-6">
                                                    <button className="flex items-center gap-1.5 text-[12px] font-medium text-zinc-400 transition-colors hover:text-[#df8448]">
                                                        <Share2 size={14} /> Share
                                                    </button>
                                                    <button className="flex items-center gap-1.5 text-[12px] font-medium text-zinc-400 transition-colors hover:text-[#df8448]">
                                                        <MessageSquare size={14} /> Discuss
                                                    </button>
                                                </div>
                                                <Link
                                                    href={`/blog/${post.slug || post.id}`}
                                                    className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#3e4c57] transition-all hover:text-[#df8448]"
                                                >
                                                    Read Story <ChevronRight size={14} />
                                                </Link>
                                            </div>
                                        </div>
                                    </article>
                                ))
                            )}
                        </div>

                        {latestPosts.length > 0 && (
                            <div className="mt-20 flex justify-center border-t border-zinc-100 pt-10">
                                <button className="rounded-[3px] bg-[#df8448] px-14 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-white shadow-xl shadow-orange-100/50 transition-all hover:bg-[#c9713a]">
                                    Load More Content
                                </button>
                            </div>
                        )}
                    </div>

                    <aside className="space-y-12 lg:w-80">
                        <div className="rounded-2xl border border-zinc-100 bg-white p-8 shadow-sm">
                            <h4 className="mb-6 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[#df8448]">
                                Follow PetPosture
                                <div className="h-1.5 w-1.5 rounded-full bg-[#df8448]/20" />
                            </h4>
                            <div className="grid grid-cols-1 gap-3">
                                {[
                                    { icon: Facebook, label: "Facebook", count: "12K", color: "#1877F2" },
                                    { icon: Instagram, label: "Instagram", count: "25K", color: "#E4405F" },
                                    { icon: Twitter, label: "Twitter (X)", count: "8K", color: "#000000" },
                                    { icon: Youtube, label: "Youtube", count: "15K", color: "#FF0000" },
                                ].map((social) => (
                                    <button
                                        key={social.label}
                                        className="group flex items-center justify-between rounded-xl border border-zinc-100/50 bg-[#f8f9fa] p-3.5 transition-all hover:bg-zinc-100"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-100 bg-white shadow-sm transition-colors group-hover:border-[#df8448]/30">
                                                <social.icon size={16} style={{ color: social.color }} />
                                            </div>
                                            <span className="text-[13px] font-bold text-[#3e4c57]">{social.label}</span>
                                        </div>
                                        <span className="text-[11px] font-bold text-zinc-400">{social.count}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {posts.length > 0 && (
                            <div>
                                <h4 className="mb-8 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[#df8448]">
                                    Most Discussed
                                    <div className="h-[1px] flex-1 bg-zinc-100" />
                                </h4>
                                <div className="space-y-7">
                                    <div className="group relative aspect-[16/10] cursor-pointer overflow-hidden rounded-xl shadow-sm">
                                        <Image
                                            src={posts[0].featured_image || "/assets/placeholder-post.jpg"}
                                            alt={posts[0].title}
                                            fill
                                            className="object-cover transition-transform duration-500 group-hover:scale-110"
                                            sizes="320px"
                                        />
                                        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-[#3e4c57]/90 via-[#3e4c57]/20 to-transparent p-5">
                                            <span className="mb-2 w-fit rounded-[2px] bg-[#df8448] px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-white">
                                                Editor&apos;s Pick
                                            </span>
                                            <h5 className="line-clamp-2 text-[15px] font-bold leading-tight text-white transition-colors group-hover:text-[#df8448]">
                                                {posts[0].title}
                                            </h5>
                                        </div>
                                    </div>
                                    {posts.slice(1, 4).map((post) => (
                                        <div key={post.id} className="group flex cursor-pointer gap-4">
                                            <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-zinc-100 shadow-sm">
                                                <Image
                                                    src={post.featured_image || "/assets/placeholder-post.jpg"}
                                                    alt={post.title}
                                                    fill
                                                    className="object-cover transition-transform group-hover:scale-110"
                                                    sizes="64px"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <h6 className="mb-1 line-clamp-2 text-[13px] font-bold leading-snug text-[#3e4c57] transition-colors group-hover:text-[#df8448]">
                                                    {post.title}
                                                </h6>
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                                                    {post.created_at
                                                        ? new Date(post.created_at).toLocaleDateString()
                                                        : "Recently published"}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="relative overflow-hidden rounded-2xl border border-zinc-100 bg-[#f8f9fa] p-8">
                            <h4 className="mb-4 text-[14px] font-bold uppercase tracking-[0.1em] text-[#3e4c57]">
                                Never miss a post
                            </h4>
                            <p className="mb-6 text-[13px] text-[#666666]">
                                Join 5,000+ pet parents getting our weekly ergonomics report.
                            </p>
                            <input
                                type="email"
                                placeholder="Your email"
                                className="mb-4 w-full rounded-[3px] border border-zinc-200 px-4 py-3 text-[13px] outline-none focus:border-[#df8448]"
                            />
                            <button className="w-full rounded-[3px] bg-[#df8448] py-3 text-[11px] font-bold uppercase tracking-[0.15em] text-white transition-all hover:bg-[#c9713a]">
                                Subscribe
                            </button>
                        </div>

                        <div className="relative overflow-hidden rounded-2xl border border-zinc-100 bg-[#f8f9fa] p-8 text-center text-[#3e4c57]">
                            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
                                <Bookmark className="text-[#df8448]" size={20} />
                            </div>
                            <p className="relative z-10 text-[15px] font-bold italic leading-relaxed">
                                &quot;A dog doesn&apos;t need much, but they deserve to be comfortable while they wait for you.&quot;
                            </p>
                            <div className="absolute right-0 top-0 -mr-12 -mt-12 h-24 w-24 rounded-full bg-[#df8448]/5" />
                            <div className="absolute bottom-0 left-0 -mb-12 -ml-12 h-24 w-24 rounded-full bg-[#3e4c57]/5" />
                        </div>
                    </aside>
                </div>
            </section>

            <section className="border-t border-zinc-50 bg-white px-4 py-12 md:px-8">
                <div className="relative mx-auto max-w-[1000px] overflow-hidden rounded-2xl bg-[#3e4c57] p-8 text-center shadow-xl md:p-14">
                    <motion.div
                        initial="initial"
                        whileInView="animate"
                        viewport={{ once: true }}
                        variants={fadeUp}
                        className="relative z-10"
                    >
                        <h2 className="mb-4 text-[32px] font-bold tracking-tight text-white md:text-[36px]">
                            Stay Inside The Loop
                        </h2>
                        <p className="mx-auto mb-8 max-w-lg text-[15px] leading-relaxed text-white/70 md:text-[16px]">
                            Get the latest pet ergonomics news, breed-specific guides, and exclusive collection previews delivered to your inbox.
                        </p>
                        <div className="mx-auto flex max-w-xl flex-col gap-3 md:flex-row">
                            <input
                                type="email"
                                placeholder="Enter your email address"
                                className="flex-1 rounded-[3px] bg-white px-6 py-4 text-[14px] font-medium text-[#3e4c57] outline-none"
                            />
                            <button className="whitespace-nowrap rounded-[3px] bg-[#df8448] px-10 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-white shadow-lg transition-all hover:bg-[#c9713a]">
                                Subscribe Now
                            </button>
                        </div>
                        <p className="mt-6 text-[10px] font-bold uppercase tracking-widest text-white/30">
                            By subscribing, you agree to our privacy policy and terms.
                        </p>
                    </motion.div>
                    <div className="absolute left-0 top-0 -ml-24 -mt-24 h-48 w-48 rounded-full bg-[#df8448]/10 blur-[80px]" />
                    <div className="absolute bottom-0 right-0 -mb-24 -mr-24 h-48 w-48 rounded-full bg-white/5 blur-[80px]" />
                </div>
            </section>

            <Footer />
        </main>
    );
}
