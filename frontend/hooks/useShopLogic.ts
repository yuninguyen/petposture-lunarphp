import { useState, useMemo, useEffect, useRef } from 'react';
import { Product } from '@/types/shop';
import { PRODUCTS as MOCK_PRODUCTS } from '@/lib/shopData';
import { getApiBaseUrl } from '@/lib/api';

export type ShopCategoryOption = {
    name: string;
    count: number;
};

export function useShopLogic(initialProducts: Product[] = MOCK_PRODUCTS) {
    const [activeCategory, setActiveCategory] = useState('All');
    const [sortBy, setSortBy] = useState('newest');
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredProducts, setFilteredProducts] = useState<Product[]>(
        initialProducts.length > 0 ? initialProducts : MOCK_PRODUCTS
    );
    const [loading, setLoading] = useState(false);
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Categories derived from the full initial (unfiltered) product set
    const categories = useMemo<ShopCategoryOption[]>(() => {
        const base = initialProducts.length > 0 ? initialProducts : MOCK_PRODUCTS;
        const counts = base.reduce<Record<string, number>>((acc, p) => {
            if (p.category) acc[p.category] = (acc[p.category] || 0) + 1;
            return acc;
        }, {});
        return [
            { name: 'All', count: base.length },
            ...Object.entries(counts)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([name, count]) => ({ name, count })),
        ];
    }, [initialProducts]);

    const hasActiveFilters = activeCategory !== 'All' || sortBy !== 'newest' || searchQuery.trim() !== '';

    const fetchProducts = (category: string, sort: string, q: string) => {
        const params = new URLSearchParams();
        if (category !== 'All') params.set('category', category);
        if (sort !== 'newest') params.set('sort', sort);
        if (q.trim()) params.set('q', q.trim());

        // No filters: restore initial SSR data without a network call
        if (!params.toString()) {
            setFilteredProducts(initialProducts.length > 0 ? initialProducts : MOCK_PRODUCTS);
            setLoading(false);
            return () => {};
        }

        const controller = new AbortController();
        setLoading(true);

        fetch(`${getApiBaseUrl()}/api/products?${params.toString()}`, {
            signal: controller.signal,
            next: { revalidate: 0 },
        } as RequestInit)
            .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
            .then(data => {
                setFilteredProducts(Array.isArray(data?.data) ? data.data : []);
            })
            .catch(err => {
                if (err !== 'AbortError' && !(err instanceof DOMException)) {
                    setFilteredProducts([]);
                }
            })
            .finally(() => setLoading(false));

        return () => controller.abort();
    };

    // Immediate re-fetch on category / sort change
    useEffect(() => {
        const cancel = fetchProducts(activeCategory, sortBy, searchQuery);
        return cancel;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeCategory, sortBy]);

    // Debounced re-fetch on search input (300 ms)
    useEffect(() => {
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => {
            fetchProducts(activeCategory, sortBy, searchQuery);
        }, 300);
        return () => {
            if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery]);

    const clearFilters = () => {
        setActiveCategory('All');
        setSortBy('newest');
        setSearchQuery('');
    };

    return {
        categories,
        activeCategory,
        setActiveCategory,
        sortBy,
        setSortBy,
        searchQuery,
        setSearchQuery,
        filteredProducts,
        totalProducts: categories[0]?.count ?? 0,
        loading,
        clearFilters,
        hasActiveFilters,
    };
}
