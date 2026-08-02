import ShopPage from '@/components/ShopPage';
import { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { PRODUCTS as MOCK_PRODUCTS, SOLUTION_TYPES } from '@/lib/shopData';
import { Product } from '@/types/shop';
import { API_BASE_URL } from '@/lib/api';

const SOLUTION_CONTENT: Record<string, { title: string; description: string; metaDescription: string }> = {
    'eating-digestion': {
        title: 'Better Eating & Digestion',
        description: 'Tilted bowls, slow feeders, and fountains that ease strain and support healthy digestion at every meal.',
        metaDescription: 'Tilted bowls, slow feeders, and pet fountains built to ease mealtime strain and support digestion.',
    },
    'mobility-support': {
        title: 'Built for Mobility & Support',
        description: 'Ramps, stairs, and strollers that protect joints and keep pets moving comfortably, indoors and out.',
        metaDescription: 'Ramps, stairs, and strollers that protect joints and support pets with limited mobility.',
    },
    'comfort-safety': {
        title: 'Comfort & Safety, Every Day',
        description: 'Orthopedic beds, cooling mats, and supportive harnesses designed around your pet\'s everyday wellbeing.',
        metaDescription: 'Orthopedic beds, cooling mats, and supportive harnesses for everyday pet comfort and safety.',
    },
};

type Params = { slug: string };

export async function generateStaticParams() {
    return SOLUTION_TYPES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
    const { slug } = await params;
    const content = SOLUTION_CONTENT[slug];

    if (!content) return {};

    return {
        title: `Shop ${content.title} | PetPosture`,
        description: content.metaDescription,
    };
}

async function getInitialProducts(slug: string): Promise<Product[]> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/products?solution=${slug}`, {
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

    return MOCK_PRODUCTS.filter((p) => p.solutionTags?.includes(slug));
}

export default async function Page({ params }: { params: Promise<Params> }) {
    const { slug } = await params;
    const content = SOLUTION_CONTENT[slug];

    if (!content) {
        notFound();
    }

    const initialProducts = await getInitialProducts(slug);

    return (
        <Suspense fallback={<main className="min-h-screen bg-[#f7f3ee]" />}>
            <ShopPage
                initialProducts={initialProducts}
                initialSolution={slug}
                heroEyebrow="Shop by Solution"
                heroTitle={content.title}
                heroDescription={content.description}
            />
        </Suspense>
    );
}
