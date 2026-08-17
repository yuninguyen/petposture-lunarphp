import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { API_BASE_URL } from '@/lib/api';

export const metadata: Metadata = {
    title: 'Shop by Solution',
    description: 'Target your pet\'s specific everyday needs — feeding, comfort, mobility and walking.',
    alternates: { canonical: '/shop/solutions' },
    openGraph: {
        images: ['/assets/icons/shop-by-solutions.webp'],
    },
};

type SolutionSummary = {
    name: string;
    slug: string;
    description: string | null;
};

// Icon per solution slug when we have one; anything else (new solutions
// added in admin later) falls back to the generic "shop by solution" banner.
const SOLUTION_IMAGES: Record<string, string> = {
    feeding: '/assets/icons/Icon-Feeding.webp',
    comfort: '/assets/icons/Icon-Comfort.webp',
    mobility: '/assets/icons/Icon-Mobility.webp',
    walking: '/assets/icons/Icon-Walking.webp',
};
const DEFAULT_SOLUTION_IMAGE = '/assets/icons/shop-by-solutions.webp';

async function getSolutions(): Promise<SolutionSummary[]> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/solutions`, {
            next: { revalidate: 60 },
        });

        if (!response.ok) return [];

        const payload = await response.json();
        return Array.isArray(payload?.data) ? payload.data : [];
    } catch (error) {
        console.warn('Failed to fetch solutions.', error);
        return [];
    }
}

export default async function Page() {
    const solutions = await getSolutions();

    return (
        <main className="min-h-screen bg-[#f7f3ee] font-hanken">
            <Header />

            <section className="border-b border-[#e7ddd2] bg-[linear-gradient(180deg,_#faf6f1_0%,_#f3ede5_100%)] px-4 py-8 md:px-8 md:py-10">
                <div className="mx-auto max-w-[1280px]">
                    <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-rust">
                        Shop by Solution
                    </p>
                    <h1 className="max-w-[760px] text-[28px] font-bold leading-tight text-[#2d3a43] md:text-[40px]">
                        Target your pet&apos;s everyday needs.
                    </h1>
                    <p className="mt-3 max-w-[760px] text-[14px] leading-7 text-[#62666a]">
                        Feeding, comfort, mobility, or walking — pick the everyday need you want to address and shop the gear built to solve it.
                    </p>
                </div>
            </section>

            <section className="px-4 py-10 md:px-8">
                {solutions.length === 0 ? (
                    <p className="mx-auto max-w-[1280px] text-sm text-[#62666a]">No solutions published yet — check back soon.</p>
                ) : (
                    <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                        {solutions.map((solution) => (
                            <Link
                                key={solution.slug}
                                href={`/shop/solutions/${solution.slug}`}
                                className="group relative block h-[320px] overflow-hidden rounded-[24px] border border-[#eadfd3] shadow-[0_18px_50px_rgba(34,33,33,0.05)]"
                            >
                                <Image
                                    src={SOLUTION_IMAGES[solution.slug] ?? DEFAULT_SOLUTION_IMAGE}
                                    alt={solution.name}
                                    fill
                                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
                                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 via-45% to-transparent" />
                                <div className="absolute inset-x-0 bottom-0 p-6">
                                    <h2 className="mb-2 text-[19px] font-bold uppercase tracking-[0.02em] text-white">
                                        {solution.name}
                                    </h2>
                                    {solution.description && (
                                        <p className="mb-4 text-sm leading-relaxed text-white/90">
                                            {solution.description}
                                        </p>
                                    )}
                                    <span className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-[#2d3a43] transition-colors group-hover:bg-secondary group-hover:text-ink">
                                        Shop Now <ArrowUpRight size={14} />
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </section>

            <Footer />
        </main>
    );
}
