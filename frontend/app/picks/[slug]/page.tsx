import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound, permanentRedirect } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { PickDetails } from '@/components/product/PickDetails';
import { getApiBaseUrl } from '@/lib/api';
import { firstMetaDescription } from '@/lib/meta-description';
import { buildPreviewQuery } from '@/lib/preview-query';
import { SITE_URL } from '@/lib/site';
import type { Product, ProductPick } from '@/types/shop';

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type PickProduct = Product & { pick: ProductPick };

const RELATED_PICK_COUNT = 3;

type Lookup = { product: PickProduct | null; redirectSlug: string | null };

// A product that is not a Pick has no page here: it would have to be sold, and PetPosture does not sell.
async function fetchPick(slug: string, previewQuery?: string): Promise<Lookup> {
    try {
        const url = `${getApiBaseUrl()}/api/products/${encodeURIComponent(slug)}${previewQuery ? `?${previewQuery}` : ''}`;
        const response = await fetch(url, {
            cache: previewQuery ? 'no-store' : undefined,
            next: previewQuery ? undefined : { revalidate: 60 },
        });
        if (!response.ok) return { product: null, redirectSlug: null };

        const payload = await response.json();
        const redirectPath = typeof payload?.redirect?.path === 'string' ? payload.redirect.path : null;

        return {
            product: payload?.data?.pick ? (payload.data as PickProduct) : null,
            // The API answers an old product URL with the current path; the Pick lives at its last segment.
            redirectSlug: redirectPath ? (redirectPath.split('/').filter(Boolean).pop() ?? null) : null,
        };
    } catch (error) {
        console.error('Failed to fetch pick:', error);
        return { product: null, redirectSlug: null };
    }
}

// Stock is not looked at: a Pick has no PetPosture stock, so a variant with stock 0 is still a Pick.
async function fetchRelatedPicks(currentProductId: number): Promise<Product[]> {
    try {
        const response = await fetch(`${getApiBaseUrl()}/api/products?per_page=100`, { next: { revalidate: 60 } });
        if (!response.ok) return [];

        const payload = await response.json();
        const products: Product[] = Array.isArray(payload?.data) ? payload.data : [];

        return products
            .filter((candidate) => candidate.pick && candidate.productId !== currentProductId)
            .slice(0, RELATED_PICK_COUNT);
    } catch (error) {
        console.error('Failed to fetch related picks:', error);
        return [];
    }
}

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: SearchParams }): Promise<Metadata> {
    const { slug } = await params;
    const previewQuery = buildPreviewQuery(await searchParams);
    const { product } = await fetchPick(slug, previewQuery);

    if (!product) return { title: 'Pick', robots: { index: false, follow: false } };

    const seoMeta = product.seoMeta;
    const title = seoMeta?.title || product.name;
    const description = firstMetaDescription(
        [seoMeta?.description, product.description],
        `${product.name}: what we like, what to watch for, and which dogs it suits.`,
    );
    const ogTitle = seoMeta?.og_title || title;
    const ogDescription = seoMeta?.og_description || description;
    const ogImage = seoMeta?.og_image || product.image || undefined;

    return {
        title,
        description,
        alternates: { canonical: `/picks/${product.slug}` },
        // A signed preview link shows a draft, which must never be indexed.
        robots: previewQuery
            ? { index: false, follow: false }
            : { index: seoMeta?.is_indexable !== false, follow: seoMeta?.is_followable !== false },
        openGraph: {
            title: ogTitle,
            description: ogDescription,
            url: `${SITE_URL}/picks/${product.slug}`,
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

export default async function Page({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
    // Reading headers makes this route render per request. Its CSP carries a per-request nonce,
    // so a statically prerendered body (which cannot carry that nonce) would have its scripts blocked.
    await headers();

    const { slug } = await params;
    const previewQuery = buildPreviewQuery(await searchParams);
    const lookup = await fetchPick(slug, previewQuery);

    if (lookup.redirectSlug && lookup.redirectSlug !== slug) {
        permanentRedirect(`/picks/${lookup.redirectSlug}`);
    }

    const product = lookup.product;
    if (!product) notFound();

    const related = await fetchRelatedPicks(product.productId);

    return (
        <main className="min-h-screen bg-white font-hanken">
            <Header />
            <PickDetails product={product} related={related} />
            <Footer />
        </main>
    );
}
