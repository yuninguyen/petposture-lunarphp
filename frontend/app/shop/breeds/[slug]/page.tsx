import ShopPage from '@/components/ShopPage';
import { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { Product } from '@/types/shop';
import { API_BASE_URL } from '@/lib/api';
import { SITE_URL } from '@/lib/site';
import { headers } from 'next/headers';

export function buildBreedCollectionJsonLd(data: { name: string; description: string; url: string }) {
    return { '@context': 'https://schema.org', '@type': 'CollectionPage', ...data };
}

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
        description: breed.description || `Breed-focused products selected for fit and everyday comfort for ${breed.name}.`,
        alternates: { canonical: `/shop/breeds/${slug}` },
    };
}

async function getInitialProducts(slug: string): Promise<{ products: Product[]; error: boolean }> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/products?breed=${slug}`, {
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
        console.warn('Failed to fetch breed products on the server.', error);
        return { products: [], error: true };
    }
}

export default async function Page({ params }: { params: Promise<Params> }) {
    const { slug } = await params;
    const breed = await getBreed(slug);

    if (!breed) {
        notFound();
    }

    const nonce = (await headers()).get('x-nonce') ?? undefined;
    const description = breed.description || `Breed-focused products selected for fit and everyday comfort for ${breed.name}.`;
    const collectionJsonLd = buildBreedCollectionJsonLd({ name: breed.name, description, url: `${SITE_URL}/shop/breeds/${slug}` });

    const [initialProductResult, allBreeds, allSolutions] = await Promise.all([
        getInitialProducts(slug),
        getBreedOptions(),
        getSolutionOptions(),
    ]);

    return (
        <>
            <script nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }} />
            <Suspense fallback={<main className="min-h-screen bg-[#f7f3ee]" />}>
            <ShopPage
                initialProducts={initialProductResult.products}
                initialProductsError={initialProductResult.error}
                initialBreed={slug}
                allBreeds={allBreeds}
                allSolutions={allSolutions}
                heroEyebrow="Shop by Breed"
                heroTitle={`Built for ${breed.name}`}
                heroDescription={breed.description || `Breed-focused products selected for fit and everyday comfort for ${breed.name}.`}
            />
            </Suspense>
        </>
    );
}
