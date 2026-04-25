import ShopPage from '@/components/ShopPage';
import { Metadata } from 'next';
import { Suspense } from 'react';
import { PRODUCTS as MOCK_PRODUCTS } from '@/lib/shopData';
import { Product } from '@/types/shop';

export const metadata: Metadata = {
    title: 'Shop | PetPosture',
    description: 'Elite ergonomic gear for your pet\'s best life. Shop our collection of bowls, ramps, beds, and harnesses.',
};

async function getInitialProducts(): Promise<Product[]> {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

    try {
        const response = await fetch(`${apiBaseUrl}/api/products`, {
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

    return MOCK_PRODUCTS;
}

export default async function Page() {
    const initialProducts = await getInitialProducts();

    return (
        <Suspense fallback={<main className="min-h-screen bg-[#f7f3ee]" />}>
            <ShopPage initialProducts={initialProducts} />
        </Suspense>
    );
}
