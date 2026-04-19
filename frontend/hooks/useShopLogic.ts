import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Product } from '@/types/shop';
import { PRODUCTS as MOCK_PRODUCTS, CATEGORIES as MOCK_CATEGORIES } from '@/lib/shopData';

export function useShopLogic() {
    const searchParams = useSearchParams();
    const [activeCategory, setActiveCategory] = useState("All");
    const [sortBy, setSortBy] = useState("default");
    const [searchQuery, setSearchQuery] = useState("");

    const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);
    const [categories, setCategories] = useState<string[]>(MOCK_CATEGORIES);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch data from Headless Laravel Backend
    useEffect(() => {
        async function fetchShopData() {
            try {
                const [catRes, prodRes] = await Promise.all([
                    fetch('http://localhost:8000/api/categories'),
                    fetch('http://localhost:8000/api/products')
                ]);

                if (catRes.ok) {
                    const { data } = await catRes.json();
                    // Transform category objects to strings and ensure "All" is present
                    const names = data.map((c: any) => c.name);
                    if (!names.includes("All")) {
                        setCategories(["All", ...names]);
                    } else {
                        setCategories(names);
                    }
                }

                if (prodRes.ok) {
                    const { data } = await prodRes.json();
                    setProducts(data);
                }
            } catch (error) {
                console.warn('API Offline. Falling back to mock data.', error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchShopData();
    }, []);

    // Sync state with URL params
    useEffect(() => {
        const catParam = searchParams.get('category');
        if (catParam && categories.includes(catParam)) {
            setActiveCategory(catParam);
        } else if (!catParam) {
            setActiveCategory("All");
        }
    }, [searchParams, categories]);

    const filteredProducts = useMemo(() => {
        let result = [...products];

        // Filter by Category
        if (activeCategory !== "All") {
            result = result.filter((p: Product) => p.category === activeCategory);
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
    }, [activeCategory, sortBy, searchQuery, products]);

    return {
        categories,
        activeCategory,
        setActiveCategory,
        sortBy,
        setSortBy,
        searchQuery,
        setSearchQuery,
        filteredProducts,
        isLoading
    };
}
