import ShopPage from '@/components/ShopPage';
import { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { Product } from '@/types/shop';
import { API_BASE_URL } from '@/lib/api';

type Params = { slug: string };

type SolutionSummary = {
    name: string;
    slug: string;
    description: string | null;
};

async function getSolution(slug: string): Promise<SolutionSummary | null> {
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

export async function generateStaticParams() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/solutions`, { cache: 'no-store' });
        if (!response.ok) return [];
        const payload = await response.json();
        const solutions = Array.isArray(payload?.data) ? payload.data : [];
        return solutions.map((s: { slug: string }) => ({ slug: s.slug }));
    } catch {
        return [];
    }
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
    const { slug } = await params;
    const solution = await getSolution(slug);

    if (!solution) return {};

    return {
        title: `Shop ${solution.name}`,
        description: solution.description || `Practical, carefully selected products for ${solution.name.toLowerCase()}.`,
        alternates: { canonical: `/shop/solutions/${slug}` },
    };
}

async function getInitialProducts(slug: string): Promise<{ products: Product[]; error: boolean }> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/products?solution=${slug}`, {
            next: { revalidate: 60 },
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
        console.warn('Failed to fetch solution products on the server.', error);
        return { products: [], error: true };
    }
}

export default async function Page({ params }: { params: Promise<Params> }) {
    const { slug } = await params;
    const solution = await getSolution(slug);

    if (!solution) {
        notFound();
    }

    const [initialProductResult, allBreeds, allSolutions] = await Promise.all([
        getInitialProducts(slug),
        getBreedOptions(),
        getSolutionOptions(),
    ]);

    return (
        <Suspense fallback={<main className="min-h-screen bg-[#f7f3ee]" />}>
            <ShopPage
                initialProducts={initialProductResult.products}
                initialProductsError={initialProductResult.error}
                initialSolution={slug}
                allBreeds={allBreeds}
                allSolutions={allSolutions}
                heroEyebrow="Shop by Solution"
                heroTitle={solution.name}
                heroDescription={solution.description || `Practical, carefully selected products for ${solution.name.toLowerCase()}.`}
            />
        </Suspense>
    );
}
