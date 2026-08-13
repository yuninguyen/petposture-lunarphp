import { useState, useMemo, useEffect, useRef } from 'react';
import { Product } from '@/types/shop';
import { PRODUCTS as MOCK_PRODUCTS, BREED_TYPES, SOLUTION_TYPES } from '@/lib/shopData';
import { getApiBaseUrl } from '@/lib/api';

export type ShopCategoryOption = {
    name: string;
    slug: string;
    count: number;
};

export type ShopBreedOption = {
    slug: string;
    label: string;
    count: number;
};

export type ShopSolutionOption = {
    slug: string;
    label: string;
    count: number;
};

export function useShopLogic(
    initialProducts: Product[] = MOCK_PRODUCTS,
    initialBreed: string = 'All',
    initialSolution: string = 'All'
) {
    const [activeCategory, setActiveCategory] = useState('All');
    const [activeBreed, setActiveBreed] = useState(initialBreed);
    const [activeSolution, setActiveSolution] = useState(initialSolution);
    const [sortBy, setSortBy] = useState('newest');
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredProducts, setFilteredProducts] = useState<Product[]>(
        initialProducts.length > 0 ? initialProducts : MOCK_PRODUCTS
    );
    const [loading, setLoading] = useState(false);
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isFilterMountRef = useRef(true);
    const isSearchMountRef = useRef(true);

    // Categories derived from the full initial (unfiltered) product set.
    // Grouped by slug (what the API filters on), not name, since two
    // categories could theoretically share a display name.
    const categories = useMemo<ShopCategoryOption[]>(() => {
        const base = initialProducts.length > 0 ? initialProducts : MOCK_PRODUCTS;
        const bySlug = base.reduce<Record<string, { name: string; count: number }>>((acc, p) => {
            if (p.category && p.categorySlug) {
                acc[p.categorySlug] = {
                    name: p.category,
                    count: (acc[p.categorySlug]?.count || 0) + 1,
                };
            }
            return acc;
        }, {});
        return [
            { name: 'All', slug: 'All', count: base.length },
            ...Object.entries(bySlug)
                .sort(([, a], [, b]) => a.name.localeCompare(b.name))
                .map(([slug, { name, count }]) => ({ name, slug, count })),
        ];
    }, [initialProducts]);

    // Breeds derived from the full initial (unfiltered) product set
    const breeds = useMemo<ShopBreedOption[]>(() => {
        const base = initialProducts.length > 0 ? initialProducts : MOCK_PRODUCTS;
        const counts = base.reduce<Record<string, number>>((acc, p) => {
            (p.breedTags || []).forEach((tag) => {
                acc[tag] = (acc[tag] || 0) + 1;
            });
            return acc;
        }, {});
        return BREED_TYPES
            .map((b) => ({ ...b, count: counts[b.slug] || 0 }))
            .filter((b) => b.count > 0);
    }, [initialProducts]);

    // Solutions derived from the full initial (unfiltered) product set
    const solutions = useMemo<ShopSolutionOption[]>(() => {
        const base = initialProducts.length > 0 ? initialProducts : MOCK_PRODUCTS;
        const counts = base.reduce<Record<string, number>>((acc, p) => {
            (p.solutionTags || []).forEach((tag) => {
                acc[tag] = (acc[tag] || 0) + 1;
            });
            return acc;
        }, {});
        return SOLUTION_TYPES
            .map((s) => ({ ...s, count: counts[s.slug] || 0 }))
            .filter((s) => s.count > 0);
    }, [initialProducts]);

    const hasActiveFilters = activeCategory !== 'All' || activeBreed !== 'All' || activeSolution !== 'All' || sortBy !== 'newest' || searchQuery.trim() !== '';

    const fetchProducts = (category: string, breed: string, solution: string, sort: string, q: string) => {
        const params = new URLSearchParams();
        if (category !== 'All') params.set('category', category);
        if (breed !== 'All') params.set('breed', breed);
        if (solution !== 'All') params.set('solution', solution);
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

    // Immediate re-fetch on category / breed / solution / sort change.
    // Skip the very first run: SSR already provided initialProducts matching
    // the initial filters (e.g. a breed or solution landing page), and
    // re-fetching on mount would wipe that out with an empty list if the
    // API is unreachable.
    useEffect(() => {
        if (isFilterMountRef.current) {
            isFilterMountRef.current = false;
            return;
        }
        const cancel = fetchProducts(activeCategory, activeBreed, activeSolution, sortBy, searchQuery);
        return cancel;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeCategory, activeBreed, activeSolution, sortBy]);

    // Debounced re-fetch on search input (300 ms)
    useEffect(() => {
        if (isSearchMountRef.current) {
            isSearchMountRef.current = false;
            return;
        }
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => {
            fetchProducts(activeCategory, activeBreed, activeSolution, sortBy, searchQuery);
        }, 300);
        return () => {
            if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery]);

    const clearFilters = () => {
        setActiveCategory('All');
        setActiveBreed('All');
        setActiveSolution('All');
        setSortBy('newest');
        setSearchQuery('');
    };

    return {
        categories,
        activeCategory,
        setActiveCategory,
        breeds,
        activeBreed,
        setActiveBreed,
        solutions,
        activeSolution,
        setActiveSolution,
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
