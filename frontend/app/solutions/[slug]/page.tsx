import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowUpRight } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { ProductCard } from '@/components/shop/ProductCard';
import { API_BASE_URL } from '@/lib/api';
import { Product } from '@/types/shop';

type Params = { slug: string };

type SolutionPost = {
    id: string;
    title: string;
    slug: string;
    featured_image?: string | null;
    featured_image_alt?: string | null;
    read_time?: string | null;
};

type SolutionDetail = {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    products: Product[];
    posts: SolutionPost[];
};

async function getSolution(slug: string): Promise<SolutionDetail | null> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/solutions/${slug}`, {
            next: { revalidate: 60 },
        });

        if (!response.ok) return null;

        const payload = await response.json();
        return payload?.data ?? null;
    } catch (error) {
        console.warn('Failed to fetch solution.', error);
        return null;
    }
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
    const { slug } = await params;
    const solution = await getSolution(slug);

    if (!solution) return {};

    return {
        title: `${solution.name} Solutions`,
        description: solution.description ?? `Products and guides for ${solution.name.toLowerCase()}.`,
        alternates: { canonical: `/solutions/${slug}` },
    };
}

export default async function Page({ params }: { params: Promise<Params> }) {
    const { slug } = await params;
    const solution = await getSolution(slug);

    if (!solution) {
        notFound();
    }

    return (
        <main className="min-h-screen bg-[#f7f3ee] font-hanken">
            <Header />

            <section className="border-b border-[#e7ddd2] bg-[linear-gradient(180deg,_#faf6f1_0%,_#f3ede5_100%)] px-4 py-8 md:px-8 md:py-10">
                <div className="mx-auto max-w-[1280px]">
                    <p className="mb-3 text-xs font-bold uppercase tracking-[0.05em] text-rust">
                        Solution
                    </p>
                    <h1 className="max-w-[760px] text-[28px] font-bold leading-tight text-[#2d3a43] md:text-[40px]">
                        {solution.name} Solutions
                    </h1>
                    {solution.description && (
                        <p className="mt-3 max-w-[760px] text-[14px] leading-7 text-[#62666a]">
                            {solution.description}
                        </p>
                    )}
                </div>
            </section>

            <section className="px-4 py-10 md:px-8">
                <div className="mx-auto max-w-[1280px]">
                    <h2 className="mb-5 text-[21px] font-semibold text-[#2d3a43]">
                        Recommended Products
                    </h2>
                    {solution.products.length === 0 ? (
                        <p className="text-sm text-[#62666a]">No products selected for {solution.name} yet.</p>
                    ) : (
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                            {solution.products.map((product) => (
                                <ProductCard key={product.id} product={product} />
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {solution.posts.length > 0 && (
                <section className="px-4 pb-16 md:px-8">
                    <div className="mx-auto max-w-[1280px]">
                        <h2 className="mb-5 text-[21px] font-semibold text-[#2d3a43]">
                            Guides for {solution.name}
                        </h2>
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {solution.posts.map((post) => (
                                <Link
                                    key={post.id}
                                    href={`/blog/${post.slug}`}
                                    className="group block overflow-hidden rounded-[20px] border border-[#eadfd3] bg-white shadow-[0_12px_28px_rgba(34,33,33,0.04)] transition hover:-translate-y-1 hover:shadow-[0_18px_36px_rgba(34,33,33,0.08)]"
                                >
                                    {post.featured_image && (
                                        <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#f0e8e0]">
                                            <Image
                                                src={post.featured_image}
                                                alt={post.featured_image_alt || post.title}
                                                fill
                                                sizes="(max-width: 768px) 100vw, 33vw"
                                                className="object-cover transition duration-500 group-hover:scale-105"
                                            />
                                        </div>
                                    )}
                                    <div className="p-5">
                                        <h3 className="mb-2 line-clamp-2 text-[16px] font-semibold text-[#2d3a43] transition-colors group-hover:text-rust">
                                            {post.title}
                                        </h3>
                                        <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.05em] text-[#df8448] transition-colors group-hover:text-rust">
                                            Read Guide <ArrowUpRight size={14} />
                                        </span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            <Footer />
        </main>
    );
}
