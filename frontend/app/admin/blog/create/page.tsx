"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Clock, Image as ImageIcon, Layout, Loader2, Save, Type, User, ChevronRight } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getApiBaseUrl } from "@/lib/api";

type BlogCategory = {
    id: string;
    name: string;
    slug: string;
};

type CreatePostPayload = {
    title: string;
    content: string;
    blog_category_id: string;
    author: string;
    read_time: string;
    featured_image: string;
    status: "draft" | "published";
};

export default function CreatePostPage() {
    const router = useRouter();
    const apiBase = getApiBaseUrl();
    const [categories, setCategories] = useState<BlogCategory[]>([]);
    const [isLoadingCategories, setIsLoadingCategories] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState<CreatePostPayload>({
        title: "",
        content: "",
        blog_category_id: "",
        author: "",
        read_time: "",
        featured_image: "",
        status: "draft",
    });

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const res = await fetch(`${apiBase}/api/admin/blog/categories`);
                if (!res.ok) {
                    throw new Error("Failed to load categories");
                }

                const data = (await res.json()) as BlogCategory[];
                setCategories(data);
            } catch {
                setError("Could not connect to the categorization server.");
            } finally {
                setIsLoadingCategories(false);
            }
        };

        void fetchCategories();
    }, [apiBase]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            const res = await fetch(`${apiBase}/api/admin/posts`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (res.ok) {
                router.push("/admin/blog");
                return;
            }

            const data = (await res.json()) as { message?: string };
            setError(data.message || "Validation failed. Please check your inputs.");
        } catch {
            setError("System error. Please try again later.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <main className="min-h-screen bg-[#f8f9fa] font-hanken">
            <Header />

            <section className="border-b border-zinc-100 bg-white px-4 pb-12 pt-24 md:px-8">
                <div className="mx-auto max-w-[1000px]">
                    <div className="mb-8 flex items-center gap-6">
                        <Link
                            href="/admin/blog"
                            className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-100 bg-zinc-50 text-zinc-400 shadow-sm transition-all hover:bg-[#3e4c57] hover:text-white"
                        >
                            <ArrowLeft size={18} />
                        </Link>
                        <div>
                            <div className="mb-1 flex items-center gap-3">
                                <span className="text-[11px] font-black uppercase tracking-widest text-[#df8448]">New Story</span>
                                <ChevronRight size={10} className="text-zinc-300" />
                                <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Drafting Phase</span>
                            </div>
                            <h1 className="text-[32px] font-bold tracking-tight text-[#3e4c57]">Create New Post</h1>
                            <a
                                href={`${apiBase}/admin/posts/create`}
                                className="mt-3 inline-flex text-[11px] font-black uppercase tracking-widest text-[#df8448] hover:underline"
                            >
                                Open full Filament editor
                            </a>
                        </div>
                    </div>
                </div>
            </section>

            <section className="px-4 py-12 md:px-8">
                <div className="mx-auto max-w-[1000px]">
                    <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-3">
                        <div className="space-y-8 lg:col-span-2">
                            <div className="rounded-2xl border border-zinc-100 bg-white p-8 shadow-sm">
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="ml-1 text-[11px] font-black uppercase tracking-[0.2em] text-[#3e4c57]">Article Title</label>
                                        <div className="relative">
                                            <Type size={18} className="absolute left-4 top-4 text-zinc-300" />
                                            <input
                                                required
                                                type="text"
                                                placeholder="Enter a compelling title..."
                                                className="w-full rounded-xl border-2 border-transparent bg-[#f8f9fa] py-4 pl-12 pr-4 text-[16px] font-bold text-[#3e4c57] outline-none transition-all focus:border-[#df8448]/30 focus:bg-white"
                                                value={formData.title}
                                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="ml-1 text-[11px] font-black uppercase tracking-[0.2em] text-[#3e4c57]">Content Editor</label>
                                        <textarea
                                            required
                                            rows={15}
                                            placeholder="Write your story here... Support Markdown for rich formatting."
                                            className="w-full rounded-2xl border-2 border-transparent bg-[#f8f9fa] px-6 py-6 text-[15px] font-medium leading-relaxed text-zinc-600 outline-none transition-all focus:border-[#df8448]/30 focus:bg-white"
                                            value={formData.content}
                                            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-zinc-100 bg-white p-8 shadow-sm">
                                <h3 className="mb-6 flex items-center gap-3 text-[14px] font-bold text-[#3e4c57]">
                                    <ImageIcon size={18} className="text-[#df8448]" />
                                    Visual Assets
                                </h3>
                                <div className="space-y-2">
                                    <label className="ml-1 text-[11px] font-black uppercase tracking-[0.2em] text-[#3e4c57]">Featured Image URL</label>
                                    <input
                                        type="text"
                                        placeholder="https://example.com/image.jpg"
                                        className="w-full rounded-xl border-2 border-transparent bg-[#f8f9fa] px-6 py-4 text-[14px] font-medium text-[#3e4c57] outline-none transition-all focus:border-[#df8448]/30 focus:bg-white"
                                        value={formData.featured_image}
                                        onChange={(e) => setFormData({ ...formData, featured_image: e.target.value })}
                                    />
                                    <p className="ml-1 mt-1 text-[11px] italic text-zinc-400">
                                        Use a high-quality 16:9 image for best results across our network.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-8">
                            <div className="sticky top-32 rounded-2xl border border-zinc-100 bg-white p-8 shadow-sm">
                                <h3 className="mb-8 flex items-center gap-3 text-[14px] font-bold text-[#3e4c57]">
                                    <Layout size={18} className="text-[#df8448]" />
                                    Publishing Details
                                </h3>

                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="ml-1 text-[11px] font-black uppercase tracking-[0.2em] text-[#3e4c57]">Category Classification</label>
                                        <select
                                            required
                                            className="w-full cursor-pointer appearance-none rounded-xl border-2 border-transparent bg-[#f8f9fa] px-4 py-4 text-[14px] font-bold text-[#3e4c57] outline-none transition-all focus:border-[#df8448]/30 focus:bg-white"
                                            value={formData.blog_category_id}
                                            onChange={(e) => setFormData({ ...formData, blog_category_id: e.target.value })}
                                        >
                                            <option value="">Select a Category</option>
                                            {categories.map((cat) => (
                                                <option key={cat.id} value={cat.id}>
                                                    {cat.name}
                                                </option>
                                            ))}
                                        </select>
                                        {isLoadingCategories && (
                                            <p className="text-[10px] italic text-zinc-400">Syncing categories with server...</p>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <label className="ml-1 text-[11px] font-black uppercase tracking-[0.2em] text-[#3e4c57]">Author Name</label>
                                        <div className="relative">
                                            <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" />
                                            <input
                                                type="text"
                                                placeholder="e.g. Dr. Sarah Miller"
                                                className="w-full rounded-xl border-2 border-transparent bg-[#f8f9fa] py-4 pl-10 pr-4 text-[14px] font-bold text-[#3e4c57] outline-none transition-all focus:border-[#df8448]/30 focus:bg-white"
                                                value={formData.author}
                                                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="ml-1 text-[11px] font-black uppercase tracking-[0.2em] text-[#3e4c57]">Estimated Read Time</label>
                                        <div className="relative">
                                            <Clock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" />
                                            <input
                                                type="text"
                                                placeholder="e.g. 5 min read"
                                                className="w-full rounded-xl border-2 border-transparent bg-[#f8f9fa] py-4 pl-10 pr-4 text-[14px] font-bold text-[#3e4c57] outline-none transition-all focus:border-[#df8448]/30 focus:bg-white"
                                                value={formData.read_time}
                                                onChange={(e) => setFormData({ ...formData, read_time: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-4 border-t border-zinc-50 pt-8">
                                        <button
                                            type="submit"
                                            disabled={isSubmitting}
                                            className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#df8448] py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-white shadow-xl shadow-orange-100 transition-all hover:bg-[#c9713a] disabled:opacity-50"
                                        >
                                            {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                                            Save All Changes
                                        </button>
                                        <p className="text-center text-[10px] font-bold uppercase tracking-widest text-zinc-400">Last synced: Just now</p>
                                    </div>

                                    {error && (
                                        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-[12px] font-medium text-red-600">
                                            {error}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
            </section>

            <Footer />
        </main>
    );
}
