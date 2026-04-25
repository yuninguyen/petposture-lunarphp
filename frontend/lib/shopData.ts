import { Product } from '@/types/shop';

export const CATEGORIES = ["All", "Bowls", "Ramps", "Beds", "Harnesses"];

export const SORT_OPTIONS = [
    { label: "Default Sorting", value: "default" },
    { label: "Price: Low to High", value: "price-asc" },
    { label: "Price: High to Low", value: "price-desc" },
    { label: "High Rated", value: "rating" }
];

export const PRODUCTS: Product[] = [
    {
        id: 1,
        productId: 1,
        variantId: 1,
        slug: "petposture-mealtime-bowl",
        name: "PetPosture: The Mealtime Difference Bowl",
        category: "Bowls",
        categorySlug: "bowls",
        price: 59.99,
        oldPrice: 85.00,
        rating: 5,
        reviews: 214,
        image: "/assets/Dog-Bowls-5.png",
        badge: "SALE",
        isNew: false
    },
    {
        id: 2,
        productId: 2,
        variantId: 2,
        slug: "corgi-ergonomic-feeding-stand",
        name: "Corgi Ergonomic Feeding Stand",
        category: "Bowls",
        categorySlug: "bowls",
        price: 49.99,
        oldPrice: 69.99,
        rating: 5,
        reviews: 156,
        image: "/assets/Corgi.png",
        badge: "SALE",
        isNew: true
    },
    {
        id: 3,
        productId: 3,
        variantId: 3,
        slug: "posturepro-tilted-bowl",
        name: "PosturePro™ Tilted Bowl",
        category: "Bowls",
        categorySlug: "bowls",
        price: 29.00,
        rating: 5,
        reviews: 308,
        image: "/assets/Flat-Faced-Breeds.png",
        badge: "BEST SELLER",
        isNew: false
    },
    {
        id: 4,
        productId: 4,
        variantId: 4,
        slug: "ergostep-pet-ramp",
        name: "ErgoStep™ Pet Ramp",
        category: "Ramps",
        categorySlug: "ramps",
        price: 49.00,
        rating: 5,
        reviews: 182,
        image: "/assets/Shop-by-Breed.jpg",
        isNew: true
    },
    {
        id: 5,
        productId: 5,
        variantId: 5,
        slug: "comfortrest-memory-bed",
        name: "ComfortRest™ Memory Bed",
        category: "Beds",
        categorySlug: "beds",
        price: 89.00,
        rating: 5,
        reviews: 425,
        image: "/assets/Pug-Dog-Bed.jpg",
        badge: "PREMIUM",
        isNew: false
    },
    {
        id: 6,
        productId: 6,
        variantId: 6,
        slug: "spinesave-support-harness",
        name: "SpineSave™ Support Harness",
        category: "Harnesses",
        categorySlug: "harnesses",
        price: 34.00,
        rating: 4,
        reviews: 97,
        image: "/assets/shop-by-solutions.jpg",
        isNew: true
    }
];
