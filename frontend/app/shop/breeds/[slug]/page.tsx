import ShopPage from '@/components/ShopPage';
import { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { PRODUCTS as MOCK_PRODUCTS, BREED_TYPES, BREED_CONTENT } from '@/lib/shopData';
import { Product } from '@/types/shop';
import { API_BASE_URL } from '@/lib/api';

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
