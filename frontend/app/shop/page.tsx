import ShopPage from '@/components/ShopPage';
import { Metadata } from 'next';
import { Suspense } from 'react';
import { PRODUCTS as MOCK_PRODUCTS } from '@/lib/shopData';
import { Product } from '@/types/shop';
import { API_BASE_URL } from '@/lib/api';

export const metadata: Metadata = {
    title: 'Shop',
    description: 'Elite ergonomic gear for your pet\'s best life. Shop our collection of bowls, ramps, beds, and harnesses.',
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

async function getInitialProducts(q: string): Promise<Product[]> {
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

        if (Array.isArray(payload?.data) && (q || payload.data.length > 0)) {
            return payload.data;
        }
    } catch (error) {
        console.warn('Falling back to mock shop data on the server.', error);
    }

    return q ? [] : MOCK_PRODUCTS;
}

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<{ q?: string }>;
}) {
    const { q } = await searchParams;
    const [initialProducts, allBreeds, allSolutions] = await Promise.all([
        getInitialProducts(q ?? ''),
        getBreedOptions(),
        getSolutionOptions(),
    ]);

    return (
        <Suspense fallback={<main className="min-h-screen bg-[#f7f3ee]" />}>
            <ShopPage
                initialProducts={initialProducts}
                initialSearch={q ?? ''}
                allBreeds={allBreeds}
                allSolutions={allSolutions}
            />
        </Suspense>
    );
}
