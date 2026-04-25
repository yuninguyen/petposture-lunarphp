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
}
