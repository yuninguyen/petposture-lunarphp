import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Product } from '@/types/shop';
import { ProductDetails } from '@/components/product/ProductDetails';
import { ScientificBreakdown } from '@/components/product/ScientificBreakdown';
import { TrustBadgeBar } from '@/components/product/TrustBadgeBar';
import { RelatedProducts } from '@/components/product/RelatedProducts';
import { ProductReviews } from '@/components/product/ProductReviews';
import { notFound } from 'next/navigation';

import { API_BASE_URL } from '@/lib/api';

async function fetchProduct(slug: string): Promise<Product | null> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/products/${slug}`, {
            next: { revalidate: 60 },
        });

        if (!response.ok) {
            return null;
        }

        const payload = await response.json();
        return payload?.data ?? null;
    } catch (error) {
        console.error('Failed to fetch product detail:', error);
        return null;
    }
}

async function fetchProducts(): Promise<Product[]> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/products`, {
            next: { revalidate: 60 },
        });

        if (!response.ok) {
            return [];
        }

        const payload = await response.json();
        return Array.isArray(payload?.data) ? payload.data : [];
    } catch (error) {
        console.error('Failed to fetch related products:', error);
        return [];
    }
}

export default async function Page({ params }: { params: Promise<{ category: string; slug: string }> }) {
    const { slug } = await params;

    const [product, allProducts] = await Promise.all([
        fetchProduct(slug),
        fetchProducts(),
    ]);

    if (!product) {
        notFound();
    }

    const relatedProducts = allProducts
        .filter((candidate) => candidate.productId !== product.productId)
        .slice(0, 4);

    return (
        <main className="min-h-screen bg-white font-hanken">
            <Header />

            <ProductDetails product={product} />
            <TrustBadgeBar />
            <ProductReviews product={product} />
            <ScientificBreakdown product={product} />
            <RelatedProducts
                products={relatedProducts}
                currentProductId={product.productId}
            />

            <Footer />
        </main>
    );
}
