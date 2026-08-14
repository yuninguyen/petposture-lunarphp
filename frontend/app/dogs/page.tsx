import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { API_BASE_URL } from '@/lib/api';

type BreedSummary = {
    id: number;
    name: string;
    slug: string;
    body_type: string | null;
    description: string | null;
    products_count: number;
    posts_count: number;
};

export const metadata: Metadata = {
    title: 'Shop by Dog Breed',
    description: 'Product and buying guides selected for specific dog breeds.',
    alternates: { canonical: '/dogs' },
};

async function getBreeds(): Promise<BreedSummary[]> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/breeds`, {
            next: { revalidate: 60 },
        });

        if (!response.ok) return [];

        const payload = await response.json();
        return Array.isArray(payload?.data) ? payload.data : [];
    } catch (error) {
        console.warn('Failed to fetch breeds.', error);
        return [];
    }
}

export default async function Page() {
    const breeds = await getBreeds();

    return (
        <main className="min-h-screen bg-[#f7f3ee] font-hanken">
            <Header />

            <section className="border-b border-[#e7ddd2] bg-[linear-gradient(180deg,_#faf6f1_0%,_#f3ede5_100%)] px-4 py-8 md:px-8 md:py-10">
                <div className="mx-auto max-w-[1280px]">
                    <p className="mb-3 text-xs font-bold uppercase tracking-[0.05em] text-rust">
                        Dogs
                    </p>
                    <h1 className="max-w-[760px] text-[28px] font-bold leading-tight text-[#2d3a43] md:text-[40px]">
                        Product guides selected for your dog&apos;s breed.
                    </h1>
                    <p className="mt-3 max-w-[760px] text-[14px] leading-7 text-[#62666a]">
                        Every breed moves, rests and eats a little differently. Pick a breed to see the products and guides we recommend for it.
                    </p>
                </div>
            </section>

            <section className="px-4 py-10 md:px-8">
                <div className="mx-auto max-w-[1280px]">
                    {breeds.length === 0 ? (
                        <p className="text-sm text-[#62666a]">No breed guides published yet — check back soon.</p>
                    ) : (
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {breeds.map((breed) => (
                                <Link
                                    key={breed.slug}
                                    href={`/dogs/${breed.slug}`}
                                    className="group block rounded-[20px] border border-[#eadfd3] bg-white p-6 shadow-[0_12px_28px_rgba(34,33,33,0.04)] transition hover:-translate-y-1 hover:shadow-[0_18px_36px_rgba(34,33,33,0.08)]"
                                >
                                    <h2 className="mb-2 text-[20px] font-bold text-[#2d3a43] transition-colors group-hover:text-rust">
                                        {breed.name}
                                    </h2>
                                    {breed.description && (
                                        <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-[#62666a]">
                                            {breed.description}
                                        </p>
                                    )}
                                    <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.05em] text-[#54646e] transition-colors group-hover:text-rust">
                                        View Guide <ArrowUpRight size={14} />
                                    </span>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            <Footer />
        </main>
    );
}
