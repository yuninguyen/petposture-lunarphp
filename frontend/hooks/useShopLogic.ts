import { useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Product } from '@/types/shop';
import { PRODUCTS as MOCK_PRODUCTS } from '@/lib/shopData';

export type ShopCategoryOption = {
    name: string;
    count: number;
};

export function useShopLogic(initialProducts: Product[] = MOCK_PRODUCTS) {
    const searchParams = useSearchParams();
    const initialCategory = searchParams.get('category') || "All";
    const [activeCategory, setActiveCategory] = useState(initialCategory);
    const [sortBy, setSortBy] = useState("default");
    const [searchQuery, setSearchQuery] = useState("");
    const [products] = useState<Product[]>(initialProducts.length > 0 ? initialProducts : MOCK_PRODUCTS);

    const categories = useMemo<ShopCategoryOption[]>(() => {
        const counts = products.reduce<Record<string, number>>((acc, product) => {
            if (!product.category) {
                return acc;
            }

            acc[product.category] = (acc[product.category] || 0) + 1;
            return acc;
        }, {});

        return [
            { name: "All", count: products.length },
            ...Object.entries(counts)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([name, count]) => ({ name, count })),
        ];
    }, [products]);

    const resolvedActiveCategory = categories.some((category) => category.name === activeCategory)
        ? activeCategory
        : "All";

    const filteredProducts = useMemo(() => {
        let result = [...products];

        // Filter by Category
        if (resolvedActiveCategory !== "All") {
            result = result.filter((p: Product) => p.category === resolvedActiveCategory);
        }

        // Filter by Search
        if (searchQuery) {
            result = result.filter((p: Product) =>
                p.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        // Sort
        if (sortBy === "price-asc") {
            result.sort((a: Product, b: Product) => a.price - b.price);
        } else if (sortBy === "price-desc") {
            result.sort((a: Product, b: Product) => b.price - a.price);
        } else if (sortBy === "rating") {
            result.sort((a: Product, b: Product) => b.rating - a.rating);
        }

        return result;
    }, [resolvedActiveCategory, sortBy, searchQuery, products]);

    const clearFilters = () => {
        setActiveCategory("All");
        setSortBy("default");
        setSearchQuery("");
    };

    return {
        categories,
        activeCategory: resolvedActiveCategory,
        setActiveCategory,
        sortBy,
        setSortBy,
        searchQuery,
        setSearchQuery,
        filteredProducts,
        totalProducts: products.length,
        clearFilters,
        hasActiveFilters: resolvedActiveCategory !== "All" || sortBy !== "default" || searchQuery.trim().length > 0,
    };
}
