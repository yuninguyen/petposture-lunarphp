import ShopPage from '@/components/ShopPage';
import { Metadata } from 'next';
import { Suspense } from 'react';
import { PRODUCTS as MOCK_PRODUCTS } from '@/lib/shopData';
import { Product } from '@/types/shop';
import { API_BASE_URL } from '@/lib/api';

export const metadata: Metadata = {
    title: 'Shop Flat-Faced Breed Essentials | PetPosture',
    description: 'Elevated, tilted bowls and anti-strain harnesses for Pugs, Bulldogs & French Bulldogs.',
};

async function getInitialProducts(): Promise<Product[]> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/products?breed=flat-faced`, {
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

    return MOCK_PRODUCTS.filter((p) => p.breedTags?.includes('flat-faced'));
}

export default async function Page() {
    const initialProducts = await getInitialProducts();

    return (
        <Suspense fallback={<main className="min-h-screen bg-[#f7f3ee]" />}>
            <ShopPage
                initialProducts={initialProducts}
                initialBreed="flat-faced"
                heroEyebrow="Shop by Breed"
                heroTitle="Built for Flat-Faced Breeds"
                heroDescription="Pugs, Bulldogs & French Bulldogs benefit most from elevated, tilted bowls and anti-strain harnesses that ease pressure on short snouts and airways."
            />
        </Suspense>
    );
}
