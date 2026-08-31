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

type BreedSummary = {
    name: string;
    slug: string;
    description: string | null;
};

const BREED_IMAGES: Record<string, string> = {
    dachshund: '/assets/breeds/Breed-Dachshund.webp',
    'french-bulldog': '/assets/breeds/Breed-French-Bulldog.webp',
    pug: '/assets/breeds/Breed-Pug.webp',
    'english-bulldog': '/assets/breeds/Breed-English-Bulldog.webp',
    corgi: '/assets/breeds/Breed-Corgi.webp',
};

// Editorial content per Canonical Implementation Blueprint v5 §13–16.
// Static because these are curated editorial decisions, not user data —
// Common Challenges / Product Types / What to Consider don't change per
// request, only Related Products and Guides (fetched live below) do.
const SOLUTION_CONTENT: Record<string, {
    intro: string;
    challenges: string[];
    relatedBreeds: string[];
    productTypes: string[];
    considerations: string[];
}> = {
    feeding: {
        intro: "Every dog eats and drinks a little differently. This hub helps you find bowls, feeders and fountains that fit your dog's breed, body shape and everyday mealtime habits — not just what's trending.",
        challenges: [
            'Eating too quickly',
            'Bowl shape and accessibility',
            'Messy drinking',
            'Choosing bowl height or angle',
            'Stability during mealtime',
            'Ease of cleaning',
        ],
        relatedBreeds: ['french-bulldog', 'pug', 'english-bulldog', 'dachshund', 'corgi'],
        productTypes: ['Tilted Bowls', 'Slow Feeders', 'Water Fountains'],
        considerations: [
            'Bowl material',
            'Bowl depth',
            'Angle',
            'Stability',
            'Cleaning',
            'Size and capacity',
            'Floor grip',
            'Replacement filters, where relevant',
        ],
    },
    comfort: {
        intro: 'Resting comfortably looks different for every dog. This hub helps you find beds and mats that fit your dog\'s body shape, sleeping habits and home environment.',
        challenges: [
            'Finding a comfortable resting surface',
            'Warm-weather comfort',
            'Choosing bed size and shape',
            'Easy-clean resting products',
            'Finding practical sleeping options for different body shapes',
        ],
        relatedBreeds: ['french-bulldog', 'pug', 'english-bulldog', 'dachshund', 'corgi'],
        productTypes: ['Supportive & Orthopedic Beds', 'Cooling Mats'],
        considerations: [
            'Size',
            'Thickness',
            'Foam / support structure',
            'Cover',
            'Washability',
            'Material',
            'Temperature behavior',
            'Durability',
            'Ease of cleaning',
        ],
    },
    mobility: {
        intro: "Getting on and off furniture, up stairs, or in and out of the car isn't the same for every dog. This hub helps you find ramps, stairs and strollers sized for your dog's build.",
        challenges: [
            'Getting onto sofas or beds',
            'Furniture access',
            'Navigating steps',
            'Travel access',
            'Choosing between ramps and stairs',
            'Product dimensions for short-legged, low-bodied dogs',
        ],
        relatedBreeds: ['dachshund', 'corgi', 'french-bulldog', 'pug', 'english-bulldog'],
        productTypes: ['Dog Ramps', 'Dog Stairs', 'Dog Strollers'],
        considerations: [
            'Height',
            'Incline',
            'Width',
            'Grip',
            'Stability',
            'Weight capacity',
            'Foldability',
            'Portability and storage',
            'Product dimensions',
        ],
    },
    walking: {
        intro: 'A harness that fits well makes daily walks easier for both of you. This hub helps you find a fit that works for your dog\'s chest shape and everyday routine.',
        challenges: [
            'Finding a comfortable harness fit',
            'Adjustment and sizing',
            'Everyday walking control',
            'Ease of putting on and taking off',
            'Fit differences across body shapes',
        ],
        relatedBreeds: ['dachshund', 'french-bulldog', 'pug', 'corgi', 'english-bulldog'],
        productTypes: ['Dog Harnesses'],
        considerations: [
            'Sizing',
            'Adjustment points',
            'Chest shape',
            'Strap placement',
            'Buckle quality',
            'Material',
            'Ease of use',
            'Leash attachment',
            'Washability',
        ],
    },
};

const ALL_SOLUTIONS = [
    { name: 'Feeding', slug: 'feeding' },
    { name: 'Comfort', slug: 'comfort' },
    { name: 'Mobility', slug: 'mobility' },
    { name: 'Walking', slug: 'walking' },
];

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

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
    const { slug } = await params;
    const solution = await getSolution(slug);

    if (!solution) return {};

    return {
        title: `${solution.name} Solutions for Dogs`,
        description: solution.description ?? `Guides and gear for ${solution.name.toLowerCase()} — organized by breed and everyday use.`,
        alternates: { canonical: `/solutions/${slug}` },
    };
}

export default async function Page({ params }: { params: Promise<Params> }) {
    const { slug } = await params;
    const [solution, allBreeds] = await Promise.all([getSolution(slug), getBreeds()]);

    if (!solution) {
        notFound();
    }

    const content = SOLUTION_CONTENT[slug];
    const relatedBreeds = content
        ? content.relatedBreeds
            .map((breedSlug) => allBreeds.find((b) => b.slug === breedSlug))
            .filter((b): b is BreedSummary => Boolean(b))
        : [];
    const otherSolutions = ALL_SOLUTIONS.filter((s) => s.slug !== slug);

    return (
        <main className="min-h-screen bg-[#f7f3ee] font-hanken">
            <Header />

            {/* H1 + Intro */}
            <section className="border-b border-[#e7ddd2] bg-[linear-gradient(180deg,_#faf6f1_0%,_#f3ede5_100%)] px-4 py-8 md:px-8 md:py-10">
                <div className="mx-auto max-w-[1280px]">
                    <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-rust">
                        Solution Guide
                    </p>
                    <h1 className="max-w-[760px] text-[28px] font-bold leading-tight text-[#2d3a43] md:text-[40px]">
                        {solution.name} Solutions for Dogs
                    </h1>
                    <p className="mt-3 max-w-[760px] text-[14px] leading-7 text-[#62666a]">
                        {content?.intro ?? solution.description}
                    </p>
                </div>
            </section>

            <div className="mx-auto max-w-[1280px] px-4 py-10 md:px-8">
                <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
                    <div className="lg:col-span-2 space-y-10">

                        {/* Common Challenges */}
                        {content && (
                            <section>
                                <h2 className="mb-4 text-[19px] font-bold text-[#2d3a43]">Common Challenges</h2>
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

                        {/* Explore Product Types */}
                        {content && (
                            <section>
                                <h2 className="mb-4 text-[19px] font-bold text-[#2d3a43]">Explore Product Types</h2>
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

                        {/* What to Consider */}
                        {content && (
                            <section>
                                <h2 className="mb-4 text-[19px] font-bold text-[#2d3a43]">What to Consider</h2>
                                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    {content.considerations.map((item) => (
                                        <li key={item} className="flex items-start gap-2 text-sm text-[#62666a]">
                                            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-rust" />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}

                        {/* Latest Guides & Comparisons — only real, published posts */}
                        {solution.posts.length > 0 && (
                            <section>
                                <h2 className="mb-4 text-[19px] font-bold text-[#2d3a43]">Latest Guides &amp; Comparisons</h2>
                                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
                                                <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.05em] text-rust transition-colors group-hover:text-rust">
                                                    Read Guide <ArrowUpRight size={14} />
                                                </span>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* PetPosture Picks — only when products are actually mapped */}
                        {solution.products.length > 0 && (
                            <section>
                                <h2 className="mb-4 text-[19px] font-bold text-[#2d3a43]">PetPosture Picks</h2>
                                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                                    {solution.products.map((product) => (
                                        <ProductCard key={product.id} product={product} />
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>

                    <aside className="space-y-8">
                        {/* Dogs We Focus On */}
                        {relatedBreeds.length > 0 && (
                            <section>
                                <h2 className="mb-4 text-[19px] font-bold text-[#2d3a43]">Dogs We Focus On</h2>
                                <div className="grid grid-cols-2 gap-3">
                                    {relatedBreeds.map((breed) => (
                                        <Link
                                            key={breed.slug}
                                            href={`/dogs/${breed.slug}`}
                                            className="group block overflow-hidden rounded-[16px] border border-[#eadfd3] bg-white shadow-[0_10px_24px_rgba(34,33,33,0.04)] transition hover:-translate-y-0.5"
                                        >
                                            <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#f0e8e0]">
                                                <Image
                                                    src={BREED_IMAGES[breed.slug] ?? '/assets/breeds/Shop-by-Breed.webp'}
                                                    alt={breed.name}
                                                    fill
                                                    sizes="160px"
                                                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                                                />
                                            </div>
                                            <p className="px-3 py-2.5 text-xs font-bold text-[#2d3a43] transition-colors group-hover:text-rust">
                                                {breed.name}
                                            </p>
                                        </Link>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Related Solutions */}
                        <section>
                            <h2 className="mb-4 text-[19px] font-bold text-[#2d3a43]">Related Solutions</h2>
                            <ul className="space-y-2">
                                {otherSolutions.map((s) => (
                                    <li key={s.slug}>
                                        <Link
                                            href={`/solutions/${s.slug}`}
                                            className="flex items-center justify-between rounded-[14px] border border-[#eadfd3] bg-white px-4 py-3 text-sm font-semibold text-[#2d3a43] transition hover:border-rust hover:text-rust"
                                        >
                                            {s.name}
                                            <ArrowUpRight size={14} />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </section>

                        {/* Commerce CTA */}
                        <section className="rounded-[20px] border border-[#eadfd3] bg-white p-6 text-center">
                            <p className="mb-4 text-sm text-[#62666a]">Ready to shop?</p>
                            <Link
                                href={`/shop/solutions/${slug}`}
                                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-xs font-bold uppercase tracking-[0.08em] text-white transition-colors hover:bg-rust"
                            >
                                Shop {solution.name} Products <ArrowUpRight size={14} />
                            </Link>
                        </section>
                    </aside>
                </div>
            </div>

            <Footer />
        </main>
    );
}
