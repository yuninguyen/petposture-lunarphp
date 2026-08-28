import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Product } from '@/types/shop';
import { ProductDetails } from '@/components/product/ProductDetails';
import { ScientificBreakdown } from '@/components/product/ScientificBreakdown';
import { TrustBadgeBar } from '@/components/product/TrustBadgeBar';
import { RelatedProducts } from '@/components/product/RelatedProducts';
import { ProductReviews } from '@/components/product/ProductReviews';
import { notFound, redirect } from 'next/navigation';

import { API_BASE_URL } from '@/lib/api';
import { buildPreviewQuery } from '@/lib/preview-query';
import { stripHtml } from '@/lib/text';

type ProductLookup = {
    product: Product | null;
    redirectPath: string | null;
};

async function fetchProduct(slug: string, previewQuery?: string): Promise<ProductLookup> {
    try {
        const url = previewQuery
            ? `${API_BASE_URL}/api/products/${slug}?${previewQuery}`
            : `${API_BASE_URL}/api/products/${slug}`;
        const response = await fetch(url, {
            cache: previewQuery ? 'no-store' : undefined,
            next: previewQuery ? undefined : { revalidate: 60 },
        });

        if (!response.ok) {
            return { product: null, redirectPath: null };
        }

        const payload = await response.json();
        return {
            product: payload?.data ?? null,
            redirectPath: typeof payload?.redirect?.path === 'string' ? payload.redirect.path : null,
        };
    } catch (error) {
        console.error('Failed to fetch product detail:', error);
        return { product: null, redirectPath: null };
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

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params, searchParams }: { params: Promise<{ category: string; slug: string }>; searchParams: SearchParams }): Promise<Metadata> {
    const { category, slug } = await params;
    const lookup = await fetchProduct(slug, buildPreviewQuery(await searchParams));

    if (lookup.redirectPath) {
        redirect(lookup.redirectPath);
    }

    const product = lookup.product;
    if (!product) {
        return { title: 'Product' };
    }

    const description = product.description
        ? stripHtml(product.description).slice(0, 160)
        : `${product.name} — ergonomic essentials from PetPosture.`;

    return {
        title: product.name,
        description,
        alternates: { canonical: `/shop/${category}/${slug}` },
        openGraph: {
            title: product.name,
            description,
            type: 'website',
            images: product.image ? [{ url: product.image }] : undefined,
        },
        twitter: {
            card: product.image ? 'summary_large_image' : 'summary',
            title: product.name,
            description,
            images: product.image ? [product.image] : undefined,
        },
    };
}

export default async function Page({ params, searchParams }: { params: Promise<{ category: string; slug: string }>; searchParams: SearchParams }) {
    const { slug } = await params;
    const previewQuery = buildPreviewQuery(await searchParams);

    const [lookup, allProducts] = await Promise.all([
        fetchProduct(slug, previewQuery),
        fetchProducts(),
    ]);

    if (lookup.redirectPath) {
        redirect(lookup.redirectPath);
    }

    const product = lookup.product;
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
