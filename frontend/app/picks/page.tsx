import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { PicksIndex } from '@/components/product/PicksIndex';
import { getApiBaseUrl } from '@/lib/api';
import { PICKS_PATH, filterPicksByBreed, filterPicksBySolution, paginatePicks, pickProducts, picksHref } from '@/lib/pick';
import type { Product } from '@/types/shop';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const DESCRIPTION = 'Products we looked at for dogs with a particular body shape: what we like and what to know first.';

// A page number below 2, or anything that is not a whole number, means the first page.
function requestedPage(raw: string | string[] | undefined): number {
    const number = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number.NaN;

    return Number.isInteger(number) && number > 1 ? number : 1;
}

const isChosen = (value: string | string[] | undefined) => typeof value === 'string' && value !== '';

// The first page, and every filtered view, keep /picks as their address; page 2 and on are their own pages.
export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
    const { breed, solution, page: rawPage } = await searchParams;
    const page = requestedPage(rawPage);
    const filtered = isChosen(breed) || isChosen(solution);

    return {
        title: page > 1 ? `PetPosture Picks, page ${page}` : 'PetPosture Picks',
        description: DESCRIPTION,
        alternates: { canonical: page > 1 && !filtered ? picksHref({ breed: null, solution: null, page }) : '/picks' },
    };
}

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

    const { breed: rawBreed, solution: rawSolution, page: rawPage } = await searchParams;
    const breed = typeof rawBreed === 'string' && rawBreed ? rawBreed : null;
    const solution = typeof rawSolution === 'string' && rawSolution ? rawSolution : null;
    const page = requestedPage(rawPage);

    const all = await fetchPicks();

    // A page past the end (a list that got shorter, or a typed address) goes to the last page instead of showing nothing.
    const { pages } = paginatePicks(filterPicksBySolution(filterPicksByBreed(all, breed), solution), page);
    if (page > pages) redirect(picksHref({ breed, solution, page: pages }));

    return (
        <main className="min-h-screen bg-white font-hanken">
            <Header />
            <PicksIndex allPicks={all} breed={breed} solution={solution} page={page} now={new Date()} />
            <Footer />
        </main>
    );
}
