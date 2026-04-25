"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Edit3, FileText, Filter, Layout, List, Plus, Search, Trash2 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getApiBaseUrl } from "@/lib/api";

type AdminPost = {
    id: string;
    title: string;
    featured_image?: string | null;
    author?: string | null;
    status: "draft" | "published";
    created_at?: string | null;
    blog_category?: {
        id: string;
        name: string;
        slug: string;
    } | null;
};

type AdminPostResponse =
    | { data: AdminPost[] }
    | AdminPost[];

export default function AdminBlogDashboard() {
    const [posts, setPosts] = useState<AdminPost[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const apiBase = getApiBaseUrl();

    useEffect(() => {
        const fetchPosts = async () => {
            try {
                const res = await fetch(`${apiBase}/api/admin/posts`);
                if (!res.ok) {
                    throw new Error("Failed to fetch posts");
                }

                const data = (await res.json()) as AdminPostResponse;
                setPosts(Array.isArray(data) ? data : (data.data ?? []));
            } catch {
                setError("Could not load blog posts. Please check your backend connection.");
            } finally {
                setIsLoading(false);
            }
        };

        void fetchPosts();
    }, [apiBase]);

    const deletePost = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this post?")) {
            return;
        }

        try {
            const res = await fetch(`${apiBase}/api/admin/posts/${id}`, { method: "DELETE" });
            if (res.ok) {
                setPosts((currentPosts) => currentPosts.filter((post) => post.id !== id));
            }
        } catch {
            setError("Failed to delete post.");
        }
    };

    return (
        <main className="min-h-screen bg-[#f8f9fa] font-hanken">
            <Header />

            <section className="border-b border-zinc-100 bg-white px-4 pb-12 pt-24 md:px-8">
                <div className="mx-auto max-w-[1200px]">
                    <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
                        <div>
                            <div className="mb-4 flex items-center gap-3">
                                <span className="rounded-full bg-[#3e4c57] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                                    Admin Dashboard
                                </span>
                                <span className="h-1.5 w-1.5 rounded-full bg-zinc-200" />
                                <span className="text-[12px] font-bold uppercase tracking-wider text-zinc-400">
                                    CMS Management
                                </span>
                            </div>
                            <h1 className="text-[32px] font-bold tracking-tight text-[#3e4c57] md:text-[42px]">
                                Content Management
                            </h1>
                        </div>
                        <Link
                            href="/admin/blog/create"
                            className="flex w-fit items-center gap-3 rounded-xl bg-[#df8448] px-8 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-white shadow-xl shadow-orange-100 transition-all hover:bg-[#c9713a]"
                        >
                            <Plus size={18} strokeWidth={3} /> Create New Post
                        </Link>
                    </div>
                </div>
            </section>

            <section className="px-4 py-12 md:px-8">
                <div className="mx-auto max-w-[1200px]">
                    <div className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-3">
                        {[
                            { label: "Total Posts", value: posts.length, icon: FileText },
                            { label: "Published", value: posts.filter((post) => post.status === "published").length, icon: Layout },
                            { label: "Total Categories", value: new Set(posts.map((post) => post.blog_category?.id).filter(Boolean)).size, icon: List },
                        ].map((stat) => (
                            <div key={stat.label} className="flex items-center gap-5 rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#df8448]/5 text-[#df8448]">
                                    <stat.icon size={24} strokeWidth={1.5} />
                                </div>
                                <div>
                                    <span className="mb-1 block text-[12px] font-bold uppercase tracking-widest text-zinc-400">
                                        {stat.label}
                                    </span>
                                    <span className="text-[24px] font-bold text-[#3e4c57]">{stat.value}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mb-8 flex flex-col items-center justify-between gap-4 rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm md:flex-row">
                        <div className="relative w-full max-w-md flex-1 text-zinc-400">
                            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Search stories by title or author..."
                                className="w-full rounded-xl border border-transparent bg-[#f8f9fa] py-3 pl-12 pr-4 text-[14px] font-medium text-[#3e4c57] outline-none focus:border-[#df8448]/30"
                            />
                        </div>
                        <div className="flex w-full items-center gap-3 md:w-auto">
                            <button className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-100 bg-[#f8f9fa] px-6 py-3 text-[13px] font-bold text-[#3e4c57] transition-colors hover:bg-zinc-100 md:flex-none">
                                <Filter size={16} /> Filters
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-[13px] font-medium text-red-600">
                            {error}
                        </div>
                    )}

                    <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-left">
                                <thead>
                                    <tr className="border-b border-zinc-100 bg-[#f8f9fa]">
                                        <th className="px-8 py-5 text-[11px] font-black uppercase tracking-widest text-zinc-400">Article Info</th>
                                        <th className="px-8 py-5 text-[11px] font-black uppercase tracking-widest text-zinc-400">Category</th>
                                        <th className="px-8 py-5 text-[11px] font-black uppercase tracking-widest text-zinc-400">Status</th>
                                        <th className="px-8 py-5 text-[11px] font-black uppercase tracking-widest text-zinc-400">Date</th>
                                        <th className="px-8 py-5 text-right text-[11px] font-black uppercase tracking-widest text-zinc-400">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={5} className="py-20 text-center font-medium italic text-zinc-400">
                                                Loading your stories...
                                            </td>
                                        </tr>
                                    ) : posts.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="py-20 text-center">
                                                <div className="mx-auto max-w-xs">
                                                    <FileText size={48} className="mx-auto mb-4 text-zinc-200" />
                                                    <p className="mb-2 text-[16px] font-bold text-[#3e4c57]">No posts found</p>
                                                    <p className="mb-6 text-[13px] leading-relaxed text-zinc-400">
                                                        Start creating your content strategy by adding your very first blog post.
                                                    </p>
                                                    <Link href="/admin/blog/create" className="text-[11px] font-black uppercase tracking-widest text-[#df8448] hover:underline">
                                                        Create Post Now
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        posts.map((post) => (
                                            <tr key={post.id} className="group border-b border-zinc-50 transition-colors hover:bg-zinc-50/50">
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-5">
                                                        <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 shadow-sm">
                                                            <Image
                                                                src={post.featured_image || "/assets/placeholder-post.jpg"}
                                                                alt={post.title}
                                                                width={48}
                                                                height={48}
                                                                className="h-full w-full object-cover"
                                                            />
                                                        </div>
                                                        <div>
                                                            <h3 className="line-clamp-1 text-[15px] font-bold text-[#3e4c57] transition-colors group-hover:text-[#df8448]">
                                                                {post.title}
                                                            </h3>
                                                            <span className="text-[12px] font-medium text-zinc-400">
                                                                By {post.author || "System"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <span className="text-[12px] font-bold uppercase tracking-wider text-[#df8448]">
                                                        {post.blog_category?.name || "Uncategorized"}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <span
                                                        className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                                                            post.status === "published" ? "bg-green-100 text-green-600" : "bg-zinc-100 text-zinc-400"
                                                        }`}
                                                    >
                                                        {post.status}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <span className="text-[13px] font-medium text-zinc-400">
                                                        {post.created_at ? new Date(post.created_at).toLocaleDateString() : "Unknown"}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-6 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <a
                                                            href={`${apiBase}/admin/posts/${post.id}/edit`}
                                                            className="block rounded-lg border border-zinc-100 bg-zinc-50 p-2.5 text-zinc-400 transition-all hover:bg-[#3e4c57] hover:text-white"
                                                            title="Open full editor"
                                                        >
                                                            <Edit3 size={16} />
                                                        </a>
                                                        <button
                                                            onClick={() => deletePost(post.id)}
                                                            className="rounded-lg border border-zinc-100 bg-zinc-50 p-2.5 text-zinc-400 transition-all hover:bg-red-500 hover:text-white"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </main>
    );
}
