import { redirect } from 'next/navigation';

import { API_BASE_URL } from '@/lib/api';
import { Product } from '@/types/shop';

async function fetchProduct(id: string): Promise<Product | null> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/products/${id}`, {
            next: { revalidate: 60 },
        });

        if (!response.ok) {
            return null;
        }

        const payload = await response.json();
        return payload?.data ?? null;
    } catch (error) {
        console.error('Failed to resolve legacy product route:', error);
        return null;
    }
}

export default async function LegacyProductPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const product = await fetchProduct(id);

    if (!product) {
        redirect('/shop');
    }

    redirect(`/shop/${product.categorySlug}/${product.slug}`);
}
