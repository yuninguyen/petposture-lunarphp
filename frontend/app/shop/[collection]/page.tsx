import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { headers } from 'next/headers';
import ShopPage from '@/components/ShopPage';
import type { Product } from '@/types/shop';
import { API_BASE_URL } from '@/lib/api';
import { SITE_URL } from '@/lib/site';
import { buildShopCollectionJsonLd } from '../json-ld';

type Params = { collection: string };
type CollectionProducts = { products: Product[]; error: boolean };

function fallbackCollectionName(slug: string): string {
    return slug
        .split('-')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

async function getCollectionProducts(slug: string): Promise<CollectionProducts> {
    try {
        const query = new URLSearchParams({ category: slug });
        const response = await fetch(`${API_BASE_URL}/api/products?${query.toString()}`, {
            next: { revalidate: 60 },
        });

        if (!response.ok) {
            throw new Error(`Failed to load collection products: ${response.status}`);
        }

        const payload = await response.json();
        return {
            products: Array.isArray(payload?.data) ? payload.data : [],
            error: false,
        };
    } catch (error) {
        console.warn('Failed to load collection products.', error);
        return { products: [], error: true };
    }
}

async function getBrowseOptions<T>(path: string, key: string, labelKey: string): Promise<T[]> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/${path}`, { next: { revalidate: 60 } });
        if (!response.ok) return [];
        const payload = await response.json();
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        return rows.map((row: Record<string, unknown>) => ({
            slug: row.slug,
            label: row[labelKey],
        })) as T[];
    } catch {
        return [];
    }
}

async function getCollectionName(slug: string): Promise<string> {
    const { products } = await getCollectionProducts(slug);
    return products.find((product) => product.categorySlug === slug)?.category
        || fallbackCollectionName(slug);
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
    const { collection } = await params;
    const name = await getCollectionName(collection);
    const description = `Browse products in the ${name} collection at PetPosture.`;

    return {
        title: `Shop ${name}`,
        description,
        alternates: { canonical: `/shop/${collection}` },
    };
}

export default async function CollectionPage({ params }: { params: Promise<Params> }) {
    const { collection } = await params;
    const [{ products, error }, allBreeds, allSolutions] = await Promise.all([
        getCollectionProducts(collection),
        getBrowseOptions<{ slug: string; label: string }>('breeds', 'slug', 'name'),
        getBrowseOptions<{ slug: string; label: string }>('solutions', 'slug', 'name'),
    ]);

    if (!error && products.length === 0) {
        notFound();
    }

    const name = products.find((product) => product.categorySlug === collection)?.category
        || fallbackCollectionName(collection);
    const description = `Browse products in the ${name} collection at PetPosture.`;
    const nonce = (await headers()).get('x-nonce') ?? undefined;
    const collectionJsonLd = buildShopCollectionJsonLd({
        name,
        description,
        url: `${SITE_URL}/shop/${collection}`,
    });

    return (
        <>
            <script nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }} />
            <Suspense fallback={<main className="min-h-screen bg-[#f7f3ee]" />}>
                <ShopPage
                    initialProducts={products}
                    initialProductsError={error}
                    allBreeds={allBreeds}
                    allSolutions={allSolutions}
                    heroEyebrow="Shop Collection"
                    heroTitle={name}
                    heroDescription={description}
                />
            </Suspense>
        </>
    );
}
