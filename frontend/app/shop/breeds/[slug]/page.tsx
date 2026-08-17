import ShopPage from '@/components/ShopPage';
import { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { PRODUCTS as MOCK_PRODUCTS } from '@/lib/shopData';
import { Product } from '@/types/shop';
import { API_BASE_URL } from '@/lib/api';

type Params = { slug: string };

type BreedSummary = {
    name: string;
    slug: string;
    description: string | null;
};

async function getBreed(slug: string): Promise<BreedSummary | null> {
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
        const response = await fetch(`${API_BASE_URL}/api/breeds`, { cache: 'no-store' });
        if (!response.ok) return [];
        const payload = await response.json();
        const breeds = Array.isArray(payload?.data) ? payload.data : [];
        return breeds.map((b: { slug: string }) => ({ slug: b.slug }));
    } catch {
        return [];
    }
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
    const { slug } = await params;
    const breed = await getBreed(slug);

    if (!breed) return {};

    return {
        title: `Shop ${breed.name}`,
        description: breed.description || `Ergonomic essentials built for ${breed.name}.`,
        alternates: { canonical: `/shop/breeds/${slug}` },
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
    const breed = await getBreed(slug);

    if (!breed) {
        notFound();
    }

    const [initialProducts, allBreeds, allSolutions] = await Promise.all([
        getInitialProducts(slug),
        getBreedOptions(),
        getSolutionOptions(),
    ]);

    return (
        <Suspense fallback={<main className="min-h-screen bg-[#f7f3ee]" />}>
            <ShopPage
                initialProducts={initialProducts}
                initialBreed={slug}
                allBreeds={allBreeds}
                allSolutions={allSolutions}
                heroEyebrow="Shop by Breed"
                heroTitle={`Built for ${breed.name}`}
                heroDescription={breed.description || `Ergonomic essentials built for ${breed.name}.`}
            />
        </Suspense>
    );
}
