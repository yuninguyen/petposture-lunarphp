"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useSyncExternalStore } from 'react';
import { Product } from '@/types/shop';
import { fetchApi } from '@/lib/fetchApi';
import { useAuth } from '@/context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WishlistContextType {
    items: Product[];
    isWishlisted: (productId: number) => boolean;
    toggle: (product: Product) => void;
    loading: boolean;
}

// ─── Guest wishlist (localStorage only — not synced across devices) ───────────

const WISHLIST_STORAGE_KEY = 'petposture_wishlist';
const WISHLIST_STORAGE_EVENT = 'petposture-wishlist-storage';

const emptyWishlist: Product[] = [];
let cachedRaw: string | null = null;
let cachedValue: Product[] = emptyWishlist;

function readGuestWishlist(): Product[] {
    if (typeof window === 'undefined') return emptyWishlist;
    const raw = localStorage.getItem(WISHLIST_STORAGE_KEY);
    if (raw === cachedRaw) return cachedValue;
    if (!raw) { cachedRaw = null; cachedValue = emptyWishlist; return cachedValue; }
    try { cachedRaw = raw; cachedValue = JSON.parse(raw); return cachedValue; }
    catch { cachedRaw = null; cachedValue = emptyWishlist; return cachedValue; }
}

function subscribeToGuestWishlist(onChange: () => void) {
    if (typeof window === 'undefined') return () => {};
    window.addEventListener(WISHLIST_STORAGE_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
        window.removeEventListener(WISHLIST_STORAGE_EVENT, onChange);
        window.removeEventListener('storage', onChange);
    };
}

function writeGuestWishlist(items: Product[]) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event(WISHLIST_STORAGE_EVENT));
}

// ─── Context ──────────────────────────────────────────────────────────────────

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export function WishlistProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const guestItems = useSyncExternalStore(subscribeToGuestWishlist, readGuestWishlist, () => emptyWishlist);
    const [serverItems, setServerItems] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchServerWishlist = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetchApi('/api/me/wishlist');
            if (res.ok) {
                const payload = await res.json();
                setServerItems(Array.isArray(payload?.data) ? payload.data : []);
            }
        } catch { /* soft-fail, keep prior state */ }
        setLoading(false);
    }, []);

    useEffect(() => {
        if (!user) return;
        Promise.resolve().then(() => fetchServerWishlist());
    }, [user, fetchServerWishlist]);

    const items = user ? serverItems : guestItems;

    const isWishlisted = (productId: number) => items.some(i => i.id === productId);

    const toggle = (product: Product) => {
        if (user) {
            const already = serverItems.some(i => i.id === product.id);
            setServerItems(already
                ? serverItems.filter(i => i.id !== product.id)
                : [product, ...serverItems]);

            if (already) {
                fetchApi(`/api/me/wishlist/${product.id}`, {
                    method: 'DELETE',
                }).catch(() => {});
            } else {
                fetchApi('/api/me/wishlist', {
                    method: 'POST',
                    body: { product_id: product.id },
                }).catch(() => {});
            }
        } else {
            const already = guestItems.some(i => i.id === product.id);
            writeGuestWishlist(already
                ? guestItems.filter(i => i.id !== product.id)
                : [product, ...guestItems]);
        }
    };

    return (
        <WishlistContext.Provider value={{ items, isWishlisted, toggle, loading }}>
            {children}
        </WishlistContext.Provider>
    );
}

export function useWishlist() {
    const ctx = useContext(WishlistContext);
    if (!ctx) throw new Error('useWishlist must be used within a WishlistProvider');
    return ctx;
}
