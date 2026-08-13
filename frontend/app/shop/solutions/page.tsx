import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { SOLUTION_TYPES, SOLUTION_CONTENT } from '@/lib/shopData';

export const metadata: Metadata = {
    title: 'Shop by Solution',
    description: 'Target your pet\'s specific health concerns — eating & digestion, mobility & support, comfort & safety.',
    alternates: { canonical: '/shop/solutions' },
};

export default function Page() {
    return (
        <main className="min-h-screen bg-[#f7f3ee] font-hanken">
            <Header />

            <section className="border-b border-[#e7ddd2] bg-[linear-gradient(180deg,_#faf6f1_0%,_#f3ede5_100%)] px-4 py-8 md:px-8 md:py-10">
                <div className="mx-auto max-w-[1280px]">
                    <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-secondary">
                        Shop by Solution
                    </p>
                    <h1 className="max-w-[760px] text-[28px] font-bold leading-tight text-[#2d3a43] md:text-[40px]">
                        Target your pet&apos;s specific health concerns.
                    </h1>
                    <p className="mt-3 max-w-[760px] text-[14px] leading-7 text-[#62666a]">
                        Digestion, mobility, or everyday comfort — pick the concern you want to address and shop the gear built to solve it.
                    </p>
                </div>
            </section>

            <section className="px-4 py-10 md:px-8">
                <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-6 md:grid-cols-3">
                    {SOLUTION_TYPES.map((solution) => {
                        const content = SOLUTION_CONTENT[solution.slug];
                        return (
                            <Link
                                key={solution.slug}
                                href={`/shop/solutions/${solution.slug}`}
                                className="group relative block h-[320px] overflow-hidden rounded-[24px] border border-[#eadfd3] shadow-[0_18px_50px_rgba(34,33,33,0.05)]"
                            >
                                <Image
                                    src={content.image}
                                    alt={content.title}
                                    fill
                                    sizes="(max-width: 768px) 100vw, 33vw"
                                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                                <div className="absolute inset-x-0 bottom-0 p-6">
                                    <h2 className="mb-2 text-[19px] font-bold uppercase tracking-[0.02em] text-white">
                                        {solution.label}
                                    </h2>
                                    <p className="mb-4 text-sm leading-relaxed text-white/80">
                                        {content.description}
                                    </p>
                                    <span className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-[#2d3a43] transition-colors group-hover:bg-secondary group-hover:text-ink">
                                        Shop Now <ArrowUpRight size={14} />
                                    </span>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </section>

            <Footer />
        </main>
    );
}
