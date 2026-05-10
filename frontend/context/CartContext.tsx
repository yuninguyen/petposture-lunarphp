"use client";

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useSyncExternalStore } from 'react';
import { Product } from '@/types/shop';
import { getApiBaseUrl } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CartItem extends Product {
    quantity: number;
}

interface CouponState {
    code: string;
    discountAmount: number;
    message: string | null;
    isError: boolean;
    type: 'percentage' | 'fixed_cart' | 'fixed_product' | null;
    amount: number | null;
    freeShipping: boolean;
}

interface CartContextType {
    items: CartItem[];
    addItem: (product: Product) => void;
    removeItem: (variantId: number) => void;
    updateQuantity: (variantId: number, quantity: number) => void;
    coupon: CouponState;
    setCoupon: (coupon: CouponState) => void;
    clearCoupon: () => void;
    totalAmount: number;
    isCartOpen: boolean;
    setCartOpen: (isOpen: boolean) => void;
    cartToken: string;
}

// ─── Local-storage cart (optimistic source of truth for UI speed) ─────────────

const CART_STORAGE_KEY    = 'petposture_cart';
const COUPON_STORAGE_KEY  = 'petposture_cart_coupon';
const CART_TOKEN_KEY      = 'petposture_cart_token';
const CART_STORAGE_EVENT  = 'petposture-cart-storage';

const defaultCouponState: CouponState = {
    code: '', discountAmount: 0, message: null, isError: false,
    type: null, amount: null, freeShipping: false,
};
const emptyCartState: CartItem[] = [];

let cachedCartRaw: string | null = null;
let cachedCartValue: CartItem[]  = emptyCartState;
let cachedCouponRaw: string | null = null;
let cachedCouponValue: CouponState = defaultCouponState;

function readStoredCart(): CartItem[] {
    if (typeof window === 'undefined') return emptyCartState;
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (raw === cachedCartRaw) return cachedCartValue;
    if (!raw) { cachedCartRaw = null; cachedCartValue = emptyCartState; return cachedCartValue; }
    try { cachedCartRaw = raw; cachedCartValue = JSON.parse(raw); return cachedCartValue; }
    catch { cachedCartRaw = null; cachedCartValue = emptyCartState; return cachedCartValue; }
}

function readStoredCoupon(): CouponState {
    if (typeof window === 'undefined') return defaultCouponState;
    const raw = localStorage.getItem(COUPON_STORAGE_KEY);
    if (raw === cachedCouponRaw) return cachedCouponValue;
    if (!raw) { cachedCouponRaw = null; cachedCouponValue = defaultCouponState; return cachedCouponValue; }
    try { cachedCouponRaw = raw; cachedCouponValue = JSON.parse(raw); return cachedCouponValue; }
    catch { cachedCouponRaw = null; cachedCouponValue = defaultCouponState; return cachedCouponValue; }
}

function subscribeToCartStorage(onChange: () => void) {
    if (typeof window === 'undefined') return () => {};
    window.addEventListener(CART_STORAGE_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
        window.removeEventListener(CART_STORAGE_EVENT, onChange);
        window.removeEventListener('storage', onChange);
    };
}

function writeCartStorage(next: { items?: CartItem[]; coupon?: CouponState }) {
    if (typeof window === 'undefined') return;
    if (next.items  !== undefined) localStorage.setItem(CART_STORAGE_KEY,   JSON.stringify(next.items));
    if (next.coupon !== undefined) localStorage.setItem(COUPON_STORAGE_KEY, JSON.stringify(next.coupon));
    window.dispatchEvent(new Event(CART_STORAGE_EVENT));
}

/** Returns the stable guest cart UUID, creating one if it doesn't exist. */
function getOrCreateCartToken(): string {
    if (typeof window === 'undefined') return '';
    let token = localStorage.getItem(CART_TOKEN_KEY);
    if (!token) {
        token = crypto.randomUUID();
        localStorage.setItem(CART_TOKEN_KEY, token);
    }
    return token;
}

// ─── Server sync helpers ──────────────────────────────────────────────────────

interface ServerLine { id: number; variantId: number; quantity: number }
interface ServerCart { token: string; lines: ServerLine[] }

function authHeaders(cartToken: string): Record<string, string> {
    const h: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Cart-Token': cartToken,
    };
    const apiToken = typeof window !== 'undefined' ? localStorage.getItem('petposture_token') : null;
    if (apiToken) h['Authorization'] = `Bearer ${apiToken}`;
    return h;
}

async function serverAddLine(cartToken: string, variantId: number, quantity: number): Promise<ServerCart | null> {
    try {
        const res = await fetch(`${getApiBaseUrl()}/api/cart/lines`, {
            method: 'POST',
            headers: authHeaders(cartToken),
            body: JSON.stringify({ variantId, quantity }),
        });
        return res.ok ? res.json() : null;
    } catch { return null; }
}

async function serverUpdateLine(cartToken: string, lineId: number, quantity: number): Promise<ServerCart | null> {
    try {
        const res = await fetch(`${getApiBaseUrl()}/api/cart/lines/${lineId}`, {
            method: 'PUT',
            headers: authHeaders(cartToken),
            body: JSON.stringify({ quantity }),
        });
        return res.ok ? res.json() : null;
    } catch { return null; }
}

async function serverRemoveLine(cartToken: string, lineId: number): Promise<ServerCart | null> {
    try {
        const res = await fetch(`${getApiBaseUrl()}/api/cart/lines/${lineId}`, {
            method: 'DELETE',
            headers: authHeaders(cartToken),
        });
        return res.ok ? res.json() : null;
    } catch { return null; }
}

async function serverFetchCart(cartToken: string): Promise<ServerCart | null> {
    try {
        const res = await fetch(`${getApiBaseUrl()}/api/cart`, {
            headers: authHeaders(cartToken),
        });
        return res.ok ? res.json() : null;
    } catch { return null; }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
    const items  = useSyncExternalStore(subscribeToCartStorage, readStoredCart,   () => emptyCartState);
    const coupon = useSyncExternalStore(subscribeToCartStorage, readStoredCoupon, () => defaultCouponState);
    const [isCartOpen, setCartOpen] = useState(false);

    // cartToken is stable per browser — used to identify guest carts on server
    const [cartToken] = useState<string>(() =>
        typeof window !== 'undefined' ? getOrCreateCartToken() : ''
    );

    // lineIdMap: variantId → server CartLine.id (needed for PUT/DELETE)
    // Not persisted — rebuilt from server on mount or after each mutation
    const lineIdMapRef = useRef<Record<number, number>>({});

    const updateLineIdMap = (serverCart: ServerCart | null) => {
        if (!serverCart) return;
        const map: Record<number, number> = {};
        serverCart.lines.forEach(l => { map[l.variantId] = l.id; });
        lineIdMapRef.current = map;
    };

    // On mount: sync lineIdMap from server (non-blocking, doesn't block UI)
    useEffect(() => {
        if (!cartToken) return;
        serverFetchCart(cartToken).then(updateLineIdMap);
    }, [cartToken]);

    // ── Mutations ──────────────────────────────────────────────────────────────

    const clearCoupon = () => writeCartStorage({ coupon: defaultCouponState });
    const setCoupon   = (next: CouponState) => writeCartStorage({ coupon: next });

    const addItem = (product: Product) => {
        // Optimistic update (instant UI)
        const existing = items.find(i => i.variantId === product.variantId);
        writeCartStorage({
            items: existing
                ? items.map(i => i.variantId === product.variantId ? { ...i, quantity: i.quantity + 1 } : i)
                : [...items, { ...product, quantity: 1 }],
            coupon: defaultCouponState,
        });
        setCartOpen(true);

        // Background server sync
        serverAddLine(cartToken, product.variantId, 1).then(updateLineIdMap);
    };

    const removeItem = (variantId: number) => {
        writeCartStorage({
            items: items.filter(i => i.variantId !== variantId),
            coupon: defaultCouponState,
        });

        const lineId = lineIdMapRef.current[variantId];
        if (lineId) {
            serverRemoveLine(cartToken, lineId).then(updateLineIdMap);
        }
    };

    const updateQuantity = (variantId: number, quantity: number) => {
        if (quantity < 1) return removeItem(variantId);

        writeCartStorage({
            items: items.map(i => i.variantId === variantId ? { ...i, quantity } : i),
            coupon: defaultCouponState,
        });

        const lineId = lineIdMapRef.current[variantId];
        if (lineId) {
            serverUpdateLine(cartToken, lineId, quantity).then(updateLineIdMap);
        }
    };

    const totalAmount = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

    return (
        <CartContext.Provider value={{
            items, addItem, removeItem, updateQuantity,
            coupon, setCoupon, clearCoupon,
            totalAmount, isCartOpen, setCartOpen,
            cartToken,
        }}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const ctx = useContext(CartContext);
    if (!ctx) throw new Error('useCart must be used within a CartProvider');
    return ctx;
}
