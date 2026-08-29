import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Product } from '@/types/shop';
import { ProductDetails } from '@/components/product/ProductDetails';
import { ScientificBreakdown } from '@/components/product/ScientificBreakdown';
import { TrustBadgeBar } from '@/components/product/TrustBadgeBar';
import { RelatedProducts } from '@/components/product/RelatedProducts';
import { ProductReviews } from '@/components/product/ProductReviews';
import { notFound, permanentRedirect } from 'next/navigation';
import { headers } from 'next/headers';

import { API_BASE_URL } from '@/lib/api';
import { SITE_URL } from '@/lib/site';
import { buildPreviewQuery } from '@/lib/preview-query';
import { stripHtml } from '@/lib/text';

type ProductLookup = {
    product: Product | null;
    redirectPath: string | null;
};

export function serializeProductJsonLd(jsonLd: Product['seo']): string | null {
    return jsonLd ? JSON.stringify(jsonLd) : null;
}

export function buildProductBreadcrumbJsonLd(siteUrl: string, product: Pick<Product, 'category' | 'categorySlug' | 'slug' | 'name'>) {
    const productUrl = `${siteUrl}/shop/${product.categorySlug}/${product.slug}`;
    const genericCategory = ['shop', 'categories'].includes(product.category.toLowerCase());
    const items = [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
        { '@type': 'ListItem', position: 2, name: 'Shop', item: `${siteUrl}/shop` },
    ];
    if (!genericCategory) {
        items.push({ '@type': 'ListItem', position: 3, name: product.category, item: `${siteUrl}/shop/${product.categorySlug}` });
    }
    items.push({ '@type': 'ListItem', position: items.length + 1, name: product.name, item: productUrl });
    return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items };
}

function serializeSearchParams(searchParams: Record<string, string | string[] | undefined>): string {
    const query = new URLSearchParams();

    Object.entries(searchParams).forEach(([key, value]) => {
        if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
        else if (value !== undefined) query.set(key, value);
    });

    return query.toString();
}

async function fetchProduct(slug: string, category: string, previewQuery?: string): Promise<ProductLookup> {
    try {
        const query = new URLSearchParams(previewQuery ?? '');
        query.set('category', category);
        const url = `${API_BASE_URL}/api/products/${slug}?${query.toString()}`;
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
    const originalQuery = serializeSearchParams(await searchParams);
    const lookup = await fetchProduct(slug, category, buildPreviewQuery(await searchParams));

    if (lookup.redirectPath) {
        permanentRedirect(originalQuery ? `${lookup.redirectPath}?${originalQuery}` : lookup.redirectPath);
    }

    const product = lookup.product;
    if (!product) {
        return { title: 'Product' };
    }

    const seoMeta = product.seoMeta;
    const title = seoMeta?.title || product.name;
    const description = seoMeta?.description
        || (product.description ? stripHtml(product.description).slice(0, 160) : null)
        || `${product.name} — carefully selected for fit, materials, dimensions and everyday usability.`;
    const ogTitle = seoMeta?.og_title || title;
    const ogDescription = seoMeta?.og_description || description;
    const ogImage = seoMeta?.og_image || product.image || undefined;

    return {
        title,
        description,
        alternates: { canonical: `/shop/${product.categorySlug}/${product.slug}` },
        robots: {
            index: seoMeta?.is_indexable !== false,
            follow: seoMeta?.is_followable !== false,
        },
        openGraph: {
            title: ogTitle,
            description: ogDescription,
            type: 'website',
            images: ogImage ? [{ url: ogImage }] : undefined,
        },
        twitter: {
            card: ogImage ? 'summary_large_image' : 'summary',
            title: ogTitle,
            description: ogDescription,
            images: ogImage ? [ogImage] : undefined,
        },
    };
}

export default async function Page({ params, searchParams }: { params: Promise<{ category: string; slug: string }>; searchParams: SearchParams }) {
    const nonce = (await headers()).get('x-nonce') ?? undefined;
    const { category, slug } = await params;
    const originalQuery = serializeSearchParams(await searchParams);
    const previewQuery = buildPreviewQuery(await searchParams);

    const [lookup, allProducts] = await Promise.all([
        fetchProduct(slug, category, previewQuery),
        fetchProducts(),
    ]);

    if (lookup.redirectPath) {
        permanentRedirect(originalQuery ? `${lookup.redirectPath}?${originalQuery}` : lookup.redirectPath);
    }

    const product = lookup.product;
    if (!product) {
        notFound();
    }

    const relatedProducts = allProducts
        .filter((candidate) => candidate.productId !== product.productId)
        .slice(0, 4);
    const breadcrumbJsonLd = buildProductBreadcrumbJsonLd(SITE_URL, product);
    const productJsonLd = serializeProductJsonLd(product.seo);

    return (
        <main className="min-h-screen bg-white font-hanken">
            {productJsonLd && (
                <script nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: productJsonLd }} />
            )}
            <script nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
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
