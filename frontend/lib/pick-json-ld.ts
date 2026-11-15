import { toMetaDescription } from './meta-description';
import type { PickProduct } from './pick';

// Structured data for a Pick page. PetPosture does not sell a Pick, so the Product carries no offer,
// price, stock level, SKU, rating or review: the price and any rating belong to the retailer and are
// shown on the page as text with their date only.
export function buildPickJsonLd(siteUrl: string, product: PickProduct) {
    const ld: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        url: `${siteUrl}/picks/${product.slug}`,
    };

    const description = toMetaDescription(product.description);
    if (description) ld.description = description;

    const image = product.images?.find((candidate) => candidate.src)?.src || product.image;
    if (image) ld.image = image;

    if (product.brand) ld.brand = { '@type': 'Brand', name: product.brand };

    return ld;
}

export function buildPickBreadcrumbJsonLd(siteUrl: string, product: Pick<PickProduct, 'name' | 'slug'>) {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
            { '@type': 'ListItem', position: 2, name: product.name, item: `${siteUrl}/picks/${product.slug}` },
        ],
    };
}

// Text typed in the admin ends up in a <script>, so "<" is escaped and "</script>" cannot close it early.
export function serializeJsonLd(value: unknown): string {
    return JSON.stringify(value).replace(/</g, '\\u003c');
}
