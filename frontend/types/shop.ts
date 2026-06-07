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
    price: number;
    oldPrice?: number | null;
    rating: number;
    reviews: number;
    image: string;
    badge?: string | null;
    isNew?: boolean;
    lowStockWarning?: boolean;
    backorder?: boolean;
    description?: string;
    options?: ProductOption[];
    variants?: ProductVariant[];
}
