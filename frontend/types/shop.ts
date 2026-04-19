export interface Product {
    id: number;
    name: string;
    category: string;
    price: number;
    oldPrice?: number;
    rating: number;
    reviews: number;
    image: string;
    badge?: string;
    isNew?: boolean;
    description?: string;
}
