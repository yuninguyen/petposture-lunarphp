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

type BreedPost = {
    id: string;
    title: string;
    slug: string;
    featured_image?: string | null;
    featured_image_alt?: string | null;
    read_time?: string | null;
};

type BreedDetail = {
    id: number;
    name: string;
    slug: string;
    body_type: string | null;
    description: string | null;
    products: Product[];
    posts: BreedPost[];
};

// Editorial content per Canonical Implementation Blueprint v5 §17.
// Static because these are curated editorial decisions, not user data —
// only Related Products and Guides (fetched live below) come from the DB.
const BREED_CONTENT: Record<string, {
    whyFitDiffers: string;
    challenges: string[];
    productTypes: string[];
}> = {
    dachshund: {
        whyFitDiffers: "Dachshunds are long-backed and short-legged, so furniture access, stairs and everyday movement are worth extra consideration when choosing gear.",
        challenges: [
            'Getting onto sofas or beds',
            'Navigating stairs',
            'Supportive rest for a long body',
            'Harness fit for a long torso',
            'Bowl height for a low stance',
        ],
        productTypes: ['Dog Ramps', 'Dog Stairs', 'Supportive & Orthopedic Beds', 'Dog Harnesses'],
    },
    corgi: {
        whyFitDiffers: "Corgis are long-backed with short legs, so furniture access, stairs and everyday movement are worth extra consideration when choosing gear.",
        challenges: [
            'Furniture access with short legs',
            'Navigating stairs',
            'Supportive rest for a long body',
            'Harness fit for a broad chest and short legs',
            'Bowl height for a low stance',
        ],
        productTypes: ['Dog Ramps', 'Dog Stairs', 'Supportive & Orthopedic Beds', 'Dog Harnesses'],
    },
    'french-bulldog': {
        whyFitDiffers: "French Bulldogs are flat-faced, so bowls and feeding setups can be harder to use, and harnesses need to fit a shorter snout and broader chest.",
        challenges: [
            'Eating too quickly',
            'Bowl shape and accessibility',
            'Warm-weather comfort',
            'Harness fit for a broad chest and short snout',
            'Choosing bed size and shape',
        ],
        productTypes: ['Tilted Bowls', 'Slow Feeders', 'Cooling Mats', 'Dog Harnesses'],
    },
    pug: {
        whyFitDiffers: "Pugs are flat-faced and prone to overheating, so feeding setups and warm-weather comfort are worth extra consideration when choosing gear.",
        challenges: [
            'Eating too quickly',
            'Bowl shape and accessibility',
            'Warm-weather comfort',
            'Harness fit for a broad chest and short snout',
            'Choosing bed size and shape',
        ],
        productTypes: ['Tilted Bowls', 'Slow Feeders', 'Cooling Mats', 'Dog Harnesses'],
    },
    'english-bulldog': {
        whyFitDiffers: "English Bulldogs are flat-faced and broad-chested, so feeding gear, resting surfaces and harnesses need to fit their build.",
        challenges: [
            'Bowl accessibility for a broad chest',
            'Warm-weather comfort',
            'Supportive rest for a heavier build',
            'Harness fit for a broad chest and short snout',
            'Choosing bed size and shape',
        ],
        productTypes: ['Tilted Bowls', 'Slow Feeders', 'Supportive & Orthopedic Beds', 'Dog Harnesses'],
    },
};

const ALL_SOLUTIONS = [
    { name: 'Feeding', slug: 'feeding' },
    { name: 'Comfort', slug: 'comfort' },
    { name: 'Mobility', slug: 'mobility' },
    { name: 'Walking', slug: 'walking' },
];

const BODY_TYPE_LABEL: Record<string, string> = {
    'flat-faced': 'Flat-Faced Dogs',
    'long-backed': 'Long-Backed & Low-Bodied Dogs',
};

async function getBreed(slug: string): Promise<BreedDetail | null> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/breeds/${slug}`, {
            next: { revalidate: 60 },
        });

        if (!response.ok) return null;

        const payload = await response.json();
        return payload?.data ?? null;
    } catch (error) {
        console.warn('Failed to fetch breed.', error);
        return null;
    }
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
    const { slug } = await params;
    const breed = await getBreed(slug);

    if (!breed) return {};

    return {
        title: `${breed.name} Product Guide`,
        description: breed.description ?? `Products and buying guides selected for ${breed.name}.`,
        alternates: { canonical: `/dogs/${slug}` },
    };
}

export default async function Page({ params }: { params: Promise<Params> }) {
    const { slug } = await params;
    const breed = await getBreed(slug);

    if (!breed) {
        notFound();
    }

    const content = BREED_CONTENT[slug];
    const bodyTypeSlug = breed.body_type === 'flat-faced' ? 'flat-faced' : breed.body_type === 'long-backed' ? 'long-backed' : null;
    const bodyTypeLabel = bodyTypeSlug ? BODY_TYPE_LABEL[bodyTypeSlug] : null;

    return (
        <main className="min-h-screen bg-[#f7f3ee] font-hanken">
            <Header />

            {/* H1 / Breed Overview */}
            <section className="border-b border-[#e7ddd2] bg-[linear-gradient(180deg,_#faf6f1_0%,_#f3ede5_100%)] px-4 py-8 md:px-8 md:py-10">
                <div className="mx-auto max-w-[1280px]">
                    <p className="mb-3 text-xs font-bold uppercase tracking-[0.05em] text-rust">
                        Dog Breed Guide
                    </p>
                    <h1 className="max-w-[760px] text-[28px] font-bold leading-tight text-[#2d3a43] md:text-[40px]">
                        {breed.name} Product Guide
                    </h1>
                    {breed.description && (
                        <p className="mt-3 max-w-[760px] text-[14px] leading-7 text-[#62666a]">
                            {breed.description}
                        </p>
                    )}
                </div>
            </section>

            <div className="mx-auto max-w-[1280px] px-4 py-10 md:px-8">
                <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
                    <div className="lg:col-span-2 space-y-10">

                        {/* Why Product Fit Can Differ */}
                        {content && (
                            <section>
                                <h2 className="mb-4 text-[19px] font-bold text-[#2d3a43]">Why Product Fit Can Differ</h2>
                                <p className="text-[14px] leading-7 text-[#62666a]">{content.whyFitDiffers}</p>
                            </section>
                        )}

                        {/* Common Everyday Challenges */}
                        {content && (
                            <section>
                                <h2 className="mb-4 text-[19px] font-bold text-[#2d3a43]">Common Everyday Challenges</h2>
                                <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                                    {content.challenges.map((item) => (
                                        <li
                                            key={item}
                                            className="rounded-[14px] border border-[#eadfd3] bg-white px-4 py-3 text-sm text-[#3d4750]"
                                        >
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}

                        {/* Explore Solutions */}
                        <section>
                            <h2 className="mb-4 text-[19px] font-bold text-[#2d3a43]">Explore Solutions</h2>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                {ALL_SOLUTIONS.map((s) => (
                                    <Link
                                        key={s.slug}
                                        href={`/solutions/${s.slug}`}
                                        className="flex items-center justify-between rounded-[14px] border border-[#eadfd3] bg-white px-4 py-3 text-sm font-semibold text-[#2d3a43] transition hover:border-rust hover:text-rust"
                                    >
                                        {s.name}
                                        <ArrowUpRight size={14} />
                                    </Link>
                                ))}
                            </div>
                        </section>

                        {/* Recommended Product Types */}
                        {content && (
                            <section>
                                <h2 className="mb-4 text-[19px] font-bold text-[#2d3a43]">Recommended Product Types</h2>
                                <div className="flex flex-wrap gap-2.5">
                                    {content.productTypes.map((type) => (
                                        <span
                                            key={type}
                                            className="rounded-full border border-[#eadfd3] bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.05em] text-[#54646e]"
                                        >
                                            {type}
                                        </span>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Latest Breed Guides — only real, published posts */}
                        {breed.posts.length > 0 && (
                            <section>
                                <h2 className="mb-4 text-[19px] font-bold text-[#2d3a43]">Latest Breed Guides</h2>
                                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                    {breed.posts.map((post) => (
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
                            </section>
                        )}

                        {/* PetPosture Picks — only when products are actually mapped */}
                        {breed.products.length > 0 && (
                            <section>
                                <h2 className="mb-4 text-[19px] font-bold text-[#2d3a43]">PetPosture Picks</h2>
                                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                                    {breed.products.map((product) => (
                                        <ProductCard key={product.id} product={product} />
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>

                    <aside className="space-y-8">
                        {/* Explore by Body Type */}
                        {bodyTypeSlug && bodyTypeLabel && (
                            <section>
                                <h2 className="mb-4 text-[19px] font-bold text-[#2d3a43]">Explore by Body Type</h2>
                                <Link
                                    href={`/shop/breeds/${bodyTypeSlug}`}
                                    className="flex items-center justify-between rounded-[14px] border border-[#eadfd3] bg-white px-4 py-3 text-sm font-semibold text-[#2d3a43] transition hover:border-rust hover:text-rust"
                                >
                                    {bodyTypeLabel}
                                    <ArrowUpRight size={14} />
                                </Link>
                            </section>
                        )}

                        {/* Commerce CTA */}
                        <section className="rounded-[20px] border border-[#eadfd3] bg-white p-6 text-center">
                            <p className="mb-4 text-sm text-[#62666a]">Ready to shop?</p>
                            <Link
                                href={`/shop/breeds/${slug}`}
                                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-xs font-bold uppercase tracking-[0.08em] text-white transition-colors hover:bg-rust"
                            >
                                Shop {breed.name} Products <ArrowUpRight size={14} />
                            </Link>
                        </section>
                    </aside>
                </div>
            </div>

            <Footer />
        </main>
    );
}
