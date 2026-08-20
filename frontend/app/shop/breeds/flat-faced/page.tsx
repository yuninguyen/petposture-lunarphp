import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { API_BASE_URL } from '@/lib/api';

export const metadata: Metadata = {
    title: 'Flat-Faced Breeds',
    description: 'Everyday gear for flat-faced breeds like Pugs, French Bulldogs and English Bulldogs — built around feeding setups, cooling and fit.',
    alternates: { canonical: '/shop/breeds/flat-faced' },
    openGraph: {
        images: ['/assets/breeds/Shop-by-Breed.webp'],
    },
};

type BreedSummary = {
    name: string;
    slug: string;
    body_type: string | null;
    description: string | null;
};

const BREED_IMAGES: Record<string, string> = {
    dachshund: '/assets/breeds/Breed-Dachshund.webp',
    'french-bulldog': '/assets/breeds/Breed-French-Bulldog.webp',
    pug: '/assets/breeds/Breed-Pug.webp',
    'english-bulldog': '/assets/breeds/Breed-English-Bulldog.webp',
    corgi: '/assets/breeds/Breed-Corgi.webp',
};
const DEFAULT_BREED_IMAGE = '/assets/breeds/Shop-by-Breed.webp';

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
    const breeds = (await getBreeds()).filter((b) => b.body_type === 'flat-faced');

    return (
        <main className="min-h-screen bg-[#f7f3ee] font-hanken">
            <Header />

            <section className="border-b border-[#e7ddd2] bg-[linear-gradient(180deg,_#faf6f1_0%,_#f3ede5_100%)] px-4 py-8 md:px-8 md:py-10">
                <div className="mx-auto max-w-[1280px]">
                    <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-rust">
                        Shop by Breed
                    </p>
                    <h1 className="max-w-[760px] text-[28px] font-bold leading-tight text-[#2d3a43] md:text-[40px]">
                        Flat-Faced Breeds
                    </h1>
                    <p className="mt-3 max-w-[760px] text-[14px] leading-7 text-[#62666a]">
                        Pugs, French Bulldogs and English Bulldogs often have a harder time with standard bowls and feeding setups. Shop gear built for their fit — elevated and tilted feeders, cooling essentials and harnesses sized for a shorter snout and broader chest.
                    </p>
                </div>
            </section>

            <section className="px-4 py-10 md:px-8">
                {breeds.length === 0 ? (
                    <p className="mx-auto max-w-[1280px] text-sm text-[#62666a]">No breeds published yet — check back soon.</p>
                ) : (
                    <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {breeds.map((breed) => {
                            const image = BREED_IMAGES[breed.slug] ?? DEFAULT_BREED_IMAGE;
                            return (
                                <Link
                                    key={breed.slug}
                                    href={`/shop/breeds/${breed.slug}`}
                                    className="group relative block h-[320px] overflow-hidden rounded-[24px] border border-[#eadfd3] shadow-[0_18px_50px_rgba(34,33,33,0.05)]"
                                >
                                    <Image
                                        src={image}
                                        alt={breed.name}
                                        fill
                                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 via-45% to-transparent" />
                                    <div className="absolute inset-x-0 bottom-0 p-8">
                                        <h2 className="mb-2 text-[22px] font-bold uppercase tracking-[0.02em] text-white">
                                            {breed.name}
                                        </h2>
                                        {breed.description && (
                                            <p className="mb-4 max-w-[380px] text-sm leading-relaxed text-white/90">
                                                {breed.description}
                                            </p>
                                        )}
                                        <span className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-[#2d3a43] transition-colors group-hover:bg-secondary group-hover:text-ink">
                                            Shop Now <ArrowUpRight size={14} />
                                        </span>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </section>

            <Footer />
        </main>
    );
}
