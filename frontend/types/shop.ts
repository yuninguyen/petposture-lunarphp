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

export interface Product {
    id: number;
    productId: number;
    variantId: number;
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
    options?: ProductOption[];
    variants?: ProductVariant[];
    seoMeta?: ProductSeoMeta | null;
}
