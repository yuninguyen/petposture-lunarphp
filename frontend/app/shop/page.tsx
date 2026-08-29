import ShopPage from '@/components/ShopPage';
import { Metadata } from 'next';
import { Suspense } from 'react';
import { Product } from '@/types/shop';
import { API_BASE_URL } from '@/lib/api';
import { SITE_URL } from '@/lib/site';
import { headers } from 'next/headers';

export function buildShopCollectionJsonLd(data: { name: string; description: string; url: string }) {
    return { '@context': 'https://schema.org', '@type': 'CollectionPage', ...data };
}

export const metadata: Metadata = {
    title: 'Shop',
    description: 'Carefully selected products for everyday access, comfort, and usability. Explore bowls, ramps, beds, and harnesses.',
    alternates: { canonical: '/shop' },
};

async function getBreedOptions(): Promise<{ slug: string; label: string }[]> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/breeds`, { next: { revalidate: 60 } });
        if (!response.ok) return [];
        const payload = await response.json();
        const breeds = Array.isArray(payload?.data) ? payload.data : [];
        return breeds.map((b: { slug: string; name: string }) => ({ slug: b.slug, label: b.name }));
    } catch {
        return [];
    }
}

async function getSolutionOptions(): Promise<{ slug: string; label: string }[]> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/solutions`, { next: { revalidate: 60 } });
        if (!response.ok) return [];
        const payload = await response.json();
        const solutions = Array.isArray(payload?.data) ? payload.data : [];
        return solutions.map((s: { slug: string; name: string }) => ({ slug: s.slug, label: s.name }));
    } catch {
        return [];
    }
}

async function getInitialProducts(q: string): Promise<{ products: Product[]; error: boolean }> {
    try {
        const url = q
            ? `${API_BASE_URL}/api/products?q=${encodeURIComponent(q)}`
            : `${API_BASE_URL}/api/products`;
        const response = await fetch(url, {
            next: { revalidate: q ? 0 : 60 },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch products: ${response.status}`);
        }

        const payload = await response.json();

        if (Array.isArray(payload?.data)) {
            return { products: payload.data, error: false };
        }
        return { products: [], error: true };
    } catch (error) {
        console.warn('Failed to fetch shop products on the server.', error);
        return { products: [], error: true };
    }
}

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<{ q?: string }>;
}) {
    const { q } = await searchParams;
    const nonce = (await headers()).get('x-nonce') ?? undefined;
    const [initialProductResult, allBreeds, allSolutions] = await Promise.all([
        getInitialProducts(q ?? ''),
        getBreedOptions(),
        getSolutionOptions(),
    ]);

    const collectionJsonLd = buildShopCollectionJsonLd({
        name: 'Shop',
        description: 'Carefully selected products for everyday access, comfort, and usability. Explore bowls, ramps, beds, and harnesses.',
        url: `${SITE_URL}/shop`,
    });

    return (
        <>
            <script nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }} />
            <Suspense fallback={<main className="min-h-screen bg-[#f7f3ee]" />}>
            <ShopPage
                initialProducts={initialProductResult.products}
                initialProductsError={initialProductResult.error}
                initialSearch={q ?? ''}
                allBreeds={allBreeds}
                allSolutions={allSolutions}
            />
            </Suspense>
        </>
    );
}
