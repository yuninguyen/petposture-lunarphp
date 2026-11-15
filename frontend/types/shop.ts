export interface ProductSpec {
    label: string;
    value: string;
}

export interface ProductOptionValue {
    id: number;
    name: string;
}

export interface ProductOption {
    id: number;
    name: string;
    handle: string;
    values: ProductOptionValue[];
}

export interface ProductVariantOption {
    option: string | null;
    valueId: number;
    value: string;
}

export interface ProductSeoMeta {
    title?: string | null;
    description?: string | null;
    og_title?: string | null;
    og_description?: string | null;
    og_image?: string | null;
    is_indexable?: boolean | null;
    is_followable?: boolean | null;
}

export interface ProductJsonLd {
    '@context': 'https://schema.org';
    '@type': 'Product';
    name: string;
    url: string;
    description?: string;
    image?: string;
    sku?: string;
    offers?: {
        '@type': 'Offer';
        price: number;
        priceCurrency: string;
        availability: string;
        url: string;
    };
    aggregateRating?: {
        '@type': 'AggregateRating';
        ratingValue: number;
        reviewCount: number;
    };
}

export interface ProductVariant {
    id: number;
    sku: string | null;
    name?: string | null;
    price: number;
    comparePrice?: number | null;
    stock: number;
    available: boolean;
    lowStockWarning?: boolean;
    backorder?: boolean;
    stockStatus?: string;
    image?: string | null;
    options: ProductVariantOption[];
}

/**
 * Details of a "PetPosture Pick": an affiliate product page that sends readers to a retailer.
 * `goUrl` counts the click, then redirects; the retailer URL itself is never returned.
 * The reference price is the retailer's price and only comes with its checked date (YYYY-MM-DD).
 */
export interface ProductPick {
    retailer: string | null;
    retailerName: string | null;
    goUrl: string;
    referencePrice: number | null;
    priceCheckedDate: string | null;
    bestForBreeds: string[];
    pros: string[];
    cons: string[];
}

export interface Product {
    id: number;
    productId: number;
    variantId: number;
    /** "Size: M · Color: Black" for the variant added to the cart; absent when it has no options. */
    variantLabel?: string | null;
    slug: string;
    name: string;
    category: string;
    categorySlug: string;
    breedTags?: string[];
    solutionTags?: string[];
    price: number;
    oldPrice?: number | null;
    comparePrice?: number | null;
    rating: number;
    reviews: number;
    image: string;
    images?: { id: number | null; src: string; alt?: string }[];
    badge?: string | null;
    isNew?: boolean;
    lowStockWarning?: boolean;
    backorder?: boolean;
    description?: string;
    brand?: string;
    specs?: ProductSpec[];
    /** Present only for an affiliate Pick; null or absent for an ordinary product. */
    pick?: ProductPick | null;
    options?: ProductOption[];
    variants?: ProductVariant[];
    seoMeta?: ProductSeoMeta | null;
    seo?: ProductJsonLd | null;
}
