import ShopPage from '@/components/ShopPage';
import { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { PRODUCTS as MOCK_PRODUCTS, BREED_TYPES } from '@/lib/shopData';
import { Product } from '@/types/shop';
import { API_BASE_URL } from '@/lib/api';

const BREED_CONTENT: Record<string, { title: string; description: string; metaDescription: string }> = {
    'flat-faced': {
        title: 'Built for Flat-Faced Breeds',
        description: 'Pugs, Bulldogs & French Bulldogs benefit most from elevated, tilted bowls and anti-strain harnesses that ease pressure on short snouts and airways.',
        metaDescription: 'Elevated, tilted bowls and anti-strain harnesses built for Pugs, Bulldogs, and French Bulldogs.',
    },
    'long-backed': {
        title: 'Built for Long-Backed Breeds',
        description: 'Dachshunds & Corgis need ramps, orthopedic beds, and harnesses that protect the intervertebral discs from everyday strain.',
        metaDescription: 'Ramps, orthopedic beds, and disc-protecting harnesses built for Dachshunds and Corgis.',
    },
};

type Params = { slug: string };

export async function generateStaticParams() {
    return BREED_TYPES.map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
    const { slug } = await params;
    const content = BREED_CONTENT[slug];

    if (!content) return {};

    return {
        title: `Shop ${content.title.replace('Built for ', '')}`,
        description: content.metaDescription,
    };
}

async function getInitialProducts(slug: string): Promise<Product[]> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/products?breed=${slug}`, {
            next: { revalidate: 60 },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch products: ${response.status}`);
        }

        const payload = await response.json();

        if (Array.isArray(payload?.data) && payload.data.length > 0) {
            return payload.data;
        }
    } catch (error) {
        console.warn('Falling back to mock shop data on the server.', error);
    }

    return MOCK_PRODUCTS.filter((p) => p.breedTags?.includes(slug));
}

export default async function Page({ params }: { params: Promise<Params> }) {
    const { slug } = await params;
    const content = BREED_CONTENT[slug];

    if (!content) {
        notFound();
    }

    const initialProducts = await getInitialProducts(slug);

    return (
        <Suspense fallback={<main className="min-h-screen bg-[#f7f3ee]" />}>
            <ShopPage
                initialProducts={initialProducts}
                initialBreed={slug}
                heroEyebrow="Shop by Breed"
                heroTitle={content.title}
                heroDescription={content.description}
            />
        </Suspense>
    );
}
