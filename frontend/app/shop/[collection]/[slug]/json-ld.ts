import type { Product } from '@/types/shop';

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
