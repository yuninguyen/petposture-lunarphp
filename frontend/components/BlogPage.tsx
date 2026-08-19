"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
    ArrowRight,
    BookOpen,
    Bookmark,
    ChevronLeft,
    ChevronRight,
    Facebook,
    Instagram,
    Loader2,
    MessageSquare,
    Search,
    Share2,
    User,
    Youtube,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getApiBaseUrl } from "@/lib/api";
import { formatDate } from "@/lib/date";
import { TikTokIcon, PinterestIcon } from "@/lib/socialIcons";
import { useSettings } from "@/context/SettingsContext";
import { stripHtml } from "@/lib/text";

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
    featured_image_alt?: string | null;
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
    const { social: socialLinks } = useSettings();
    const [activeTab, setActiveTab] = useState("All");
    const [posts, setPosts] = useState<BlogPost[]>([]);
    const [categories, setCategories] = useState<BlogCategory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const tabsScrollRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isSearchMountRef = useRef(true);

    const updateTabsScrollState = () => {
        const el = tabsScrollRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 4);
        setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };

    useEffect(() => {
        updateTabsScrollState();
        window.addEventListener("resize", updateTabsScrollState);
        return () => window.removeEventListener("resize", updateTabsScrollState);
    }, [categories]);

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

    // Debounced re-fetch of posts on search input (300ms)
    useEffect(() => {
        if (isSearchMountRef.current) {
            isSearchMountRef.current = false;
            return;
        }

        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(async () => {
            try {
                const apiBase = getApiBaseUrl();
                const params = new URLSearchParams();
                if (searchQuery.trim()) params.set("q", searchQuery.trim());

                const res = await fetch(`${apiBase}/api/posts?${params.toString()}`);
                if (!res.ok) throw new Error("Search failed");

                const data = (await res.json()) as PostsResponse;
                setPosts(Array.isArray(data.data) ? data.data : []);
            } catch {
                setPosts([]);
            }
        }, 300);

        return () => {
            if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        };
    }, [searchQuery]);

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
                    <Loader2 className="mx-auto mb-6 animate-spin text-rust" size={48} />
                    <p className="text-sm font-bold uppercase tracking-widest text-primary">
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
                                    src={featuredPost.featured_image || "/assets/blog/placeholder-post.webp"}
                                    alt={featuredPost.featured_image_alt || featuredPost.title}
                                    fill
                                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                                    sizes="(max-width: 1024px) 100vw, 60vw"
                                />
                                <div className="absolute left-6 top-6">
                                    <span className="rounded-[3px] bg-white/90 px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] text-rust shadow-sm backdrop-blur-sm">
                                        Featured Article
                                    </span>
                                </div>
                            </div>
                            <div className="flex flex-col justify-center p-8 md:p-12 lg:w-2/5">
                                <div className="mb-6 flex items-center gap-3">
                                    <span className="text-sm font-bold uppercase tracking-wider text-rust">
                                        {featuredPost.blog_category?.name || "Insights"}
                                    </span>
                                    <span className="h-1 w-1 rounded-full bg-zinc-300" />
                                    <span className="text-xs text-zinc-400">
                                        {featuredPost.created_at
                                            ? new Date(featuredPost.created_at).toLocaleDateString("en-US", {
                                                month: "long",
                                                day: "numeric",
                                                year: "numeric",
                                            })
                                            : "Recently published"}
                                    </span>
                                </div>
                                <Link href={`/blog/${featuredPost.slug || featuredPost.id}`}>
                                    <h1 className="mb-6 cursor-pointer text-[28px] font-bold leading-tight text-primary transition-colors hover:text-rust md:text-[36px]">
                                        {featuredPost.title}
                                    </h1>
                                </Link>
                                <p className="mb-8 line-clamp-3 text-[16px] leading-relaxed text-[#666666]">
                                    {stripHtml(featuredPost.content).substring(0, 160)}...
                                </p>
                                <div className="mt-auto flex items-center justify-between border-t border-zinc-100 pt-6">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-zinc-200 bg-zinc-100">
                                            <User size={20} className="text-zinc-400" />
                                        </div>
                                        <div>
                                            <span className="block text-[14px] font-bold text-primary">
                                                {featuredPost.author || "PetPosture Editorial"}
                                            </span>
                                            <span className="block text-xs text-zinc-400">
                                                {featuredPost.read_time || "5 min read"}
                                            </span>
                                        </div>
                                    </div>
                                    <Link
                                        href={`/blog/${featuredPost.slug || featuredPost.id}`}
                                        className="flex items-center gap-2 text-sm font-bold text-primary transition-all hover:text-rust"
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
                <div className="relative mx-auto flex max-w-[1200px] flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-8">
                    <div className="relative w-full md:max-w-[380px]">
                        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search articles..."
                            className="w-full rounded-full border border-zinc-200 py-2 pl-9 pr-4 text-sm outline-none focus:border-secondary"
                        />
                    </div>
                    <div
                        ref={tabsScrollRef}
                        onScroll={updateTabsScrollState}
                        className="flex items-center gap-2 overflow-x-auto whitespace-nowrap no-scrollbar"
                    >
                        <button
                            onClick={() => setActiveTab("All")}
                            className={`relative shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-colors md:text-sm ${activeTab === "All"
                                ? "text-white"
                                : "text-primary/60 hover:text-primary"
                                }`}
                        >
                            {activeTab === "All" && (
                                <motion.div
                                    layoutId="activeTabPill"
                                    className="absolute inset-0 rounded-full bg-secondary"
                                    transition={{ type: "spring", duration: 0.4 }}
                                />
                            )}
                            <span className="relative">All</span>
                        </button>
                        {categories.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => setActiveTab(cat.name)}
                                className={`relative shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-colors md:text-sm ${activeTab === cat.name
                                    ? "text-white"
                                    : "text-primary/60 hover:text-primary"
                                    }`}
                            >
                                {activeTab === cat.name && (
                                    <motion.div
                                        layoutId="activeTabPill"
                                        className="absolute inset-0 rounded-full bg-secondary"
                                        transition={{ type: "spring", duration: 0.4 }}
                                    />
                                )}
                                <span className="relative">{cat.name}</span>
                            </button>
                        ))}
                    </div>

                    {canScrollLeft && (
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center bg-gradient-to-r from-white to-transparent pl-1 md:hidden">
                            <ChevronLeft size={16} className="text-primary/40" />
                        </div>
                    )}
                    {canScrollRight && (
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex w-10 items-center justify-end bg-gradient-to-l from-white to-transparent pr-1 md:hidden">
                            <ChevronRight size={16} className="text-primary/40" />
                        </div>
                    )}
                </div>
            </nav>

            <section className="px-4 py-16 md:px-8">
                <div className="mx-auto flex max-w-[1200px] flex-col gap-16 lg:flex-row">
                    <div className="flex-1">
                        <h2 className="mb-10 flex items-center gap-4 text-[20px] font-bold uppercase tracking-[0.08em] text-primary">
                            Latest Stories
                            <div className="h-[1px] flex-1 bg-zinc-100" />
                        </h2>

                        {error && (
                            <div className="mb-8 rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-700">
                                {error}
                            </div>
                        )}

                        <div className="space-y-12 md:space-y-16">
                            {latestPosts.length === 0 ? (
                                <div className="rounded-2xl border border-zinc-100 bg-[#f8f9fa] py-20 text-center">
                                    <BookOpen size={40} className="mx-auto mb-4 text-zinc-200" />
                                    <p className="font-bold text-primary">No stories found in this section.</p>
                                </div>
                            ) : (
                                latestPosts.map((post) => (
                                    <article key={post.id} className="group flex flex-col gap-8 md:flex-row">
                                        <div className="relative aspect-[4/3] shrink-0 overflow-hidden rounded-xl shadow-sm md:w-[35%]">
                                            <Image
                                                src={post.featured_image || "/assets/blog/placeholder-post.webp"}
                                                alt={post.featured_image_alt || post.title}
                                                fill
                                                className="object-cover transition-transform duration-500 group-hover:scale-105"
                                                sizes="(max-width: 768px) 100vw, 35vw"
                                            />
                                            <div className="absolute left-4 top-4">
                                                <span className="rounded-[3px] bg-white/90 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-rust shadow-sm backdrop-blur-sm">
                                                    {post.blog_category?.name || "Insights"}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex flex-1 flex-col py-1">
                                            <div className="mb-3 flex items-center gap-3 text-xs font-bold text-zinc-400">
                                                <span className="text-rust">
                                                    {post.author || "PetPosture Editorial"}
                                                </span>
                                                <span className="h-1 w-1 rounded-full bg-zinc-200" />
                                                <span>
                                                    {post.created_at ? formatDate(post.created_at) : "Recently published"}
                                                </span>
                                            </div>
                                            <Link href={`/blog/${post.slug || post.id}`}>
                                                <h3 className="mb-4 line-clamp-2 cursor-pointer text-[22px] font-bold leading-tight text-primary transition-colors hover:text-rust md:text-[26px]">
                                                    {post.title}
                                                </h3>
                                            </Link>
                                            <p className="mb-6 line-clamp-3 text-[15px] leading-relaxed text-[#666666]">
                                                {stripHtml(post.content).substring(0, 140)}...
                                            </p>
                                            <div className="mt-auto flex items-center justify-between border-t border-zinc-50 pt-5">
                                                <div className="flex items-center gap-6">
                                                    <button className="flex items-center gap-1.5 text-sm font-medium text-zinc-400 transition-colors hover:text-rust">
                                                        <Share2 size={14} /> Share
                                                    </button>
                                                    <button className="flex items-center gap-1.5 text-sm font-medium text-zinc-400 transition-colors hover:text-rust">
                                                        <MessageSquare size={14} /> Discuss
                                                    </button>
                                                </div>
                                                <Link
                                                    href={`/blog/${post.slug || post.id}`}
                                                    className="flex items-center gap-2 text-sm font-bold text-primary transition-all hover:text-rust"
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
                                <button className="rounded-[3px] bg-secondary px-14 py-4 text-sm font-bold uppercase tracking-[0.08em] text-ink shadow-xl shadow-orange-100/50 transition-all hover:bg-secondary-dark">
                                    Load More Content
                                </button>
                            </div>
                        )}
                    </div>

                    <aside className="space-y-12 lg:w-80">
                        <div className="rounded-2xl border border-zinc-100 bg-white p-8 shadow-sm">
                            <h4 className="mb-6 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.08em] text-rust">
                                Follow PetPosture
                                <div className="h-1.5 w-1.5 rounded-full bg-secondary/20" />
                            </h4>
                            <div className="grid grid-cols-1 gap-3">
                                {[
                                    { icon: Facebook, label: "Facebook", color: "#1877F2", href: socialLinks.facebook },
                                    { icon: Instagram, label: "Instagram", color: "#E4405F", href: socialLinks.instagram },
                                    { icon: TikTokIcon, label: "TikTok", color: "#000000", href: socialLinks.tiktok },
                                    { icon: PinterestIcon, label: "Pinterest", color: "#E60023", href: socialLinks.pinterest },
                                    { icon: Youtube, label: "Youtube", color: "#FF0000", href: socialLinks.youtube },
                                ]
                                    .filter((item) => item.href)
                                    .map((item) => (
                                        <a
                                            key={item.label}
                                            href={item.href!}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="group flex items-center justify-between rounded-xl border border-zinc-100/50 bg-[#f8f9fa] p-3.5 transition-all hover:bg-zinc-100"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-100 bg-white shadow-sm transition-colors group-hover:border-secondary/30">
                                                    <item.icon size={16} style={{ color: item.color }} />
                                                </div>
                                                <span className="text-sm font-bold text-primary">{item.label}</span>
                                            </div>
                                        </a>
                                    ))}
                            </div>
                        </div>

                        {posts.length > 0 && (
                            <div>
                                <h4 className="mb-8 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.08em] text-rust">
                                    Most Discussed
                                    <div className="h-[1px] flex-1 bg-zinc-100" />
                                </h4>
                                <div className="space-y-7">
                                    <Link href={`/blog/${posts[0].slug || posts[0].id}`} className="group block">
                                        <div className="relative aspect-[16/10] overflow-hidden rounded-xl shadow-sm">
                                            <Image
                                                src={posts[0].featured_image || "/assets/blog/placeholder-post.webp"}
                                                alt={posts[0].featured_image_alt || posts[0].title}
                                                fill
                                                className="object-cover transition-transform duration-500 group-hover:scale-110"
                                                sizes="320px"
                                            />
                                            <span className="absolute left-3 top-3 w-fit rounded-[2px] bg-white/90 px-2 py-1 text-xs font-bold uppercase tracking-wide text-rust shadow-sm backdrop-blur-sm">
                                                Editor&apos;s Pick
                                            </span>
                                        </div>
                                        <h5 className="mt-3 line-clamp-2 text-[15px] font-bold leading-tight text-primary transition-colors group-hover:text-rust">
                                            {posts[0].title}
                                        </h5>
                                    </Link>
                                    {posts.slice(1, 4).map((post) => (
                                        <Link
                                            href={`/blog/${post.slug || post.id}`}
                                            key={post.id}
                                            className="group flex gap-4"
                                        >
                                            <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-zinc-100 shadow-sm">
                                                <Image
                                                    src={post.featured_image || "/assets/blog/placeholder-post.webp"}
                                                    alt={post.featured_image_alt || post.title}
                                                    fill
                                                    className="object-cover transition-transform group-hover:scale-110"
                                                    sizes="64px"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <h6 className="mb-1 line-clamp-2 text-sm font-bold leading-snug text-primary transition-colors group-hover:text-rust">
                                                    {post.title}
                                                </h6>
                                                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                                                    {post.created_at ? formatDate(post.created_at) : "Recently published"}
                                                </span>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="relative overflow-hidden rounded-2xl border border-zinc-100 bg-[#f8f9fa] p-8 text-center text-primary">
                            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
                                <Bookmark className="text-rust" size={20} />
                            </div>
                            <p className="relative z-10 text-[15px] font-bold italic leading-relaxed">
                                &quot;A dog doesn&apos;t need much, but they deserve to be comfortable while they wait for you.&quot;
                            </p>
                            <div className="absolute right-0 top-0 -mr-12 -mt-12 h-24 w-24 rounded-full bg-secondary/5" />
                            <div className="absolute bottom-0 left-0 -mb-12 -ml-12 h-24 w-24 rounded-full bg-primary/5" />
                        </div>
                    </aside>
                </div>
            </section>

            <Footer />
        </main>
    );
}
