import { Product } from '@/types/shop';

export const CATEGORIES = ["All", "Bowls", "Ramps", "Beds", "Harnesses"];

export const BREED_TYPES = [
    { slug: "flat-faced", label: "Flat-Faced Breeds" },
    { slug: "long-backed", label: "Long-Backed Breeds" },
];

export const SOLUTION_TYPES = [
    { slug: "eating-digestion", label: "Eating & Digestion" },
    { slug: "mobility-support", label: "Mobility & Support" },
    { slug: "comfort-safety", label: "Comfort & Safety" },
];

export type LandingContent = { title: string; description: string; metaDescription: string; image: string };

export const BREED_CONTENT: Record<string, LandingContent> = {
    'flat-faced': {
        title: 'Built for Flat-Faced Breeds',
        description: 'Pugs, Bulldogs & French Bulldogs benefit most from elevated, tilted bowls and anti-strain harnesses that ease pressure on short snouts and airways.',
        metaDescription: 'Elevated, tilted bowls and anti-strain harnesses built for Pugs, Bulldogs, and French Bulldogs.',
        image: '/assets/Flat-Faced-Breeds.png',
    },
    'long-backed': {
        title: 'Built for Long-Backed Breeds',
        description: 'Dachshunds & Corgis need ramps, orthopedic beds, and harnesses that protect the intervertebral discs from everyday strain.',
        metaDescription: 'Ramps, orthopedic beds, and disc-protecting harnesses built for Dachshunds and Corgis.',
        image: '/assets/Corgi.png',
    },
};

export const SOLUTION_CONTENT: Record<string, LandingContent> = {
    'eating-digestion': {
        title: 'Better Eating & Digestion',
        description: 'Tilted bowls, slow feeders, and fountains that ease strain and support healthy digestion at every meal.',
        metaDescription: 'Tilted bowls, slow feeders, and pet fountains built to ease mealtime strain and support digestion.',
        image: '/assets/Dog-Bowls-5.png',
    },
    'mobility-support': {
        title: 'Built for Mobility & Support',
        description: 'Ramps, stairs, and strollers that protect joints and keep pets moving comfortably, indoors and out.',
        metaDescription: 'Ramps, stairs, and strollers that protect joints and support pets with limited mobility.',
        image: '/assets/Shop-by-Breed.jpg',
    },
    'comfort-safety': {
        title: 'Comfort & Safety, Every Day',
        description: 'Orthopedic beds, cooling mats, and supportive harnesses designed around your pet\'s everyday wellbeing.',
        metaDescription: 'Orthopedic beds, cooling mats, and supportive harnesses for everyday pet comfort and safety.',
        image: '/assets/Pug-Dog-Bed.jpg',
    },
};

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
        breedTags: ["long-backed"],
        solutionTags: ["eating-digestion"],
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
        breedTags: ["flat-faced"],
        solutionTags: ["eating-digestion"],
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
        breedTags: ["long-backed"],
        solutionTags: ["mobility-support"],
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
        breedTags: ["flat-faced"],
        solutionTags: ["comfort-safety"],
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
        breedTags: ["flat-faced", "long-backed"],
        solutionTags: ["comfort-safety"],
        price: 34.00,
        rating: 4,
        reviews: 97,
        image: "/assets/shop-by-solutions.jpg",
        isNew: true
    }
];
