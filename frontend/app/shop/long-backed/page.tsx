import ShopPage from '@/components/ShopPage';
import { Metadata } from 'next';
import { Suspense } from 'react';
import { PRODUCTS as MOCK_PRODUCTS } from '@/lib/shopData';
import { Product } from '@/types/shop';
import { API_BASE_URL } from '@/lib/api';

export const metadata: Metadata = {
    title: 'Shop Long-Backed Breed Essentials | PetPosture',
    description: 'Ramps, orthopedic beds, and disc-protecting harnesses for Dachshunds & Corgis.',
};

async function getInitialProducts(): Promise<Product[]> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/products?breed=long-backed`, {
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

    return MOCK_PRODUCTS.filter((p) => p.breedTags?.includes('long-backed'));
}

export default async function Page() {
    const initialProducts = await getInitialProducts();

    return (
        <Suspense fallback={<main className="min-h-screen bg-[#f7f3ee]" />}>
            <ShopPage
                initialProducts={initialProducts}
                initialBreed="long-backed"
                heroEyebrow="Shop by Breed"
                heroTitle="Built for Long-Backed Breeds"
                heroDescription="Dachshunds & Corgis need ramps, orthopedic beds, and harnesses that protect the intervertebral discs from everyday strain."
            />
        </Suspense>
    );
}
