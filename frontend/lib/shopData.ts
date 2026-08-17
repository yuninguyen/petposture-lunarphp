import { Product } from '@/types/shop';

export const CATEGORIES = ["All", "Bowls", "Ramps", "Beds", "Harnesses"];

export const SORT_OPTIONS = [
    { label: "Default Sorting", value: "newest" },
    { label: "Price: Low to High", value: "price_asc" },
    { label: "Price: High to Low", value: "price_desc" },
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
        breedTags: ["flat-faced"],
        solutionTags: ["eating-digestion"],
        price: 59.99,
        oldPrice: 85.00,
        rating: 5,
        reviews: 214,
        image: "/assets/product/Dog-Bowls-5.webp",
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
        breedTags: ["long-backed"],
        solutionTags: ["eating-digestion"],
        price: 49.99,
        oldPrice: 69.99,
        rating: 5,
        reviews: 156,
        image: "/assets/product/Corgi.webp",
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
        breedTags: ["flat-faced"],
        solutionTags: ["eating-digestion"],
        price: 29.00,
        rating: 5,
        reviews: 308,
        image: "/assets/product/Flat-Faced-Breeds.webp",
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
        breedTags: ["long-backed"],
        solutionTags: ["mobility-support"],
        price: 49.00,
        rating: 5,
        reviews: 182,
        image: "/assets/breeds/Shop-by-Breed.webp",
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
        breedTags: ["flat-faced"],
        solutionTags: ["comfort-safety"],
        price: 89.00,
        rating: 5,
        reviews: 425,
        image: "/assets/product/Pug-Dog-Bed.webp",
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
        breedTags: ["flat-faced", "long-backed"],
        solutionTags: ["comfort-safety"],
        price: 34.00,
        rating: 4,
        reviews: 97,
        image: "/assets/icons/shop-by-solutions.webp",
        isNew: true
    }
];
