import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { PicksIndex } from '@/components/product/PicksIndex';
import { getApiBaseUrl } from '@/lib/api';
import { PICKS_PATH, pickProducts } from '@/lib/pick';
import type { Product } from '@/types/shop';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = {
    title: 'PetPosture Picks',
    description: 'Products we looked at for dogs with a particular body shape: what we like and what to know first.',
    alternates: { canonical: '/picks' },
};

async function fetchPicks() {
    try {
        const response = await fetch(`${getApiBaseUrl()}${PICKS_PATH}`, { next: { revalidate: 60 } });
        if (!response.ok) return [];

        const payload = await response.json();
        const products: Product[] = Array.isArray(payload?.data) ? payload.data : [];

        return pickProducts(products);
    } catch (error) {
        console.error('Failed to fetch picks:', error);
        return [];
    }
}

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
    // Reading headers makes this route render per request, so the nonce CSP matches the body.
    await headers();

    const { breed: rawBreed, solution: rawSolution } = await searchParams;
    const breed = typeof rawBreed === 'string' && rawBreed ? rawBreed : null;
    const solution = typeof rawSolution === 'string' && rawSolution ? rawSolution : null;

    const all = await fetchPicks();

    return (
        <main className="min-h-screen bg-white font-hanken">
            <Header />
            <PicksIndex allPicks={all} breed={breed} solution={solution} now={new Date()} />
            <Footer />
        </main>
    );
}
