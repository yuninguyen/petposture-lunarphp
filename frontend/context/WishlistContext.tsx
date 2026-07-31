"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useSyncExternalStore } from 'react';
import { Product } from '@/types/shop';
import { getApiBaseUrl } from '@/lib/api';
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
    const { token } = useAuth();
    const guestItems = useSyncExternalStore(subscribeToGuestWishlist, readGuestWishlist, () => emptyWishlist);
    const [serverItems, setServerItems] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchServerWishlist = useCallback(async (authToken: string) => {
        setLoading(true);
        try {
            const res = await fetch(`${getApiBaseUrl()}/api/me/wishlist`, {
                headers: { Authorization: `Bearer ${authToken}` },
            });
            if (res.ok) {
                const payload = await res.json();
                setServerItems(Array.isArray(payload?.data) ? payload.data : []);
            }
        } catch { /* soft-fail, keep prior state */ }
        setLoading(false);
    }, []);

    useEffect(() => {
        if (!token) return;
        // Deferred to a microtask so no setState runs synchronously within the effect body.
        // serverItems is only read while `token` is set, so it's safe to leave stale on logout.
        Promise.resolve().then(() => fetchServerWishlist(token));
    }, [token, fetchServerWishlist]);

    const items = token ? serverItems : guestItems;

    const isWishlisted = (productId: number) => items.some(i => i.id === productId);

    const toggle = (product: Product) => {
        if (token) {
            const already = serverItems.some(i => i.id === product.id);
            setServerItems(already
                ? serverItems.filter(i => i.id !== product.id)
                : [product, ...serverItems]);

            if (already) {
                fetch(`${getApiBaseUrl()}/api/me/wishlist/${product.id}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` },
                }).catch(() => {});
            } else {
                fetch(`${getApiBaseUrl()}/api/me/wishlist`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ product_id: product.id }),
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
