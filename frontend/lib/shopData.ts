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
        name: "PetPosture: The Mealtime Difference Bowl",
        category: "Bowls",
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
        name: "Corgi Ergonomic Feeding Stand",
        category: "Bowls",
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
        name: "PosturePro™ Tilted Bowl",
        category: "Bowls",
        price: 29.00,
        rating: 5,
        reviews: 308,
        image: "/assets/Flat-Faced-Breeds.png",
        badge: "BEST SELLER",
        isNew: false
    },
    {
        id: 4,
        name: "ErgoStep™ Pet Ramp",
        category: "Ramps",
        price: 49.00,
        rating: 5,
        reviews: 182,
        image: "/assets/Shop-by-Breed.jpg",
        isNew: true
    },
    {
        id: 5,
        name: "ComfortRest™ Memory Bed",
        category: "Beds",
        price: 89.00,
        rating: 5,
        reviews: 425,
        image: "/assets/Pug-Dog-Bed.jpg",
        badge: "PREMIUM",
        isNew: false
    },
    {
        id: 6,
        name: "SpineSave™ Support Harness",
        category: "Harnesses",
        price: 34.00,
        rating: 4,
        reviews: 97,
        image: "/assets/shop-by-solutions.jpg",
        isNew: true
    }
];
