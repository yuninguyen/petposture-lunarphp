"use client";

import React, { createContext, useContext, useState, ReactNode, useSyncExternalStore } from 'react';
import { Product } from '@/types/shop';

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
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const defaultCouponState: CouponState = {
    code: "",
    discountAmount: 0,
    message: null,
    isError: false,
    type: null,
    amount: null,
    freeShipping: false,
};

const emptyCartState: CartItem[] = [];

const CART_STORAGE_KEY = 'petposture_cart';
const COUPON_STORAGE_KEY = 'petposture_cart_coupon';
const CART_STORAGE_EVENT = 'petposture-cart-storage';

let cachedCartRaw: string | null = null;
let cachedCartValue: CartItem[] = emptyCartState;
let cachedCouponRaw: string | null = null;
let cachedCouponValue: CouponState = defaultCouponState;

function readStoredCart(): CartItem[] {
    if (typeof window === 'undefined') {
        return emptyCartState;
    }

    const savedCart = localStorage.getItem(CART_STORAGE_KEY);
    if (savedCart === cachedCartRaw) {
        return cachedCartValue;
    }

    if (!savedCart) {
        cachedCartRaw = null;
        cachedCartValue = emptyCartState;
        return cachedCartValue;
    }

    try {
        cachedCartRaw = savedCart;
        cachedCartValue = JSON.parse(savedCart);
        return cachedCartValue;
    } catch (e) {
        console.error("Failed to parse cart", e);
        cachedCartRaw = null;
        cachedCartValue = emptyCartState;
        return cachedCartValue;
    }
}

function readStoredCoupon(): CouponState {
    if (typeof window === 'undefined') {
        return defaultCouponState;
    }

    const savedCoupon = localStorage.getItem(COUPON_STORAGE_KEY);
    if (savedCoupon === cachedCouponRaw) {
        return cachedCouponValue;
    }

    if (!savedCoupon) {
        cachedCouponRaw = null;
        cachedCouponValue = defaultCouponState;
        return cachedCouponValue;
    }

    try {
        cachedCouponRaw = savedCoupon;
        cachedCouponValue = JSON.parse(savedCoupon);
        return cachedCouponValue;
    } catch (e) {
        console.error("Failed to parse coupon", e);
        cachedCouponRaw = null;
        cachedCouponValue = defaultCouponState;
        return cachedCouponValue;
    }
}

function subscribeToCartStorage(onStoreChange: () => void) {
    if (typeof window === 'undefined') {
        return () => {};
    }

    const handleChange = () => onStoreChange();
    window.addEventListener(CART_STORAGE_EVENT, handleChange);
    window.addEventListener('storage', handleChange);

    return () => {
        window.removeEventListener(CART_STORAGE_EVENT, handleChange);
        window.removeEventListener('storage', handleChange);
    };
}

function writeCartStorage(nextState: { items?: CartItem[]; coupon?: CouponState }) {
    if (typeof window === 'undefined') {
        return;
    }

    if (nextState.items !== undefined) {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(nextState.items));
    }

    if (nextState.coupon !== undefined) {
        localStorage.setItem(COUPON_STORAGE_KEY, JSON.stringify(nextState.coupon));
    }

    window.dispatchEvent(new Event(CART_STORAGE_EVENT));
}

export function CartProvider({ children }: { children: ReactNode }) {
    const items = useSyncExternalStore(subscribeToCartStorage, readStoredCart, () => emptyCartState);
    const coupon = useSyncExternalStore(subscribeToCartStorage, readStoredCoupon, () => defaultCouponState);
    const [isCartOpen, setCartOpen] = useState(false);

    const clearCoupon = () => {
        writeCartStorage({ coupon: defaultCouponState });
    };

    const setCoupon = (nextCoupon: CouponState) => {
        writeCartStorage({ coupon: nextCoupon });
    };

    const addItem = (product: Product) => {
        const existing = items.find(item => item.variantId === product.variantId);
        const nextItems = existing
            ? items.map(item =>
                item.variantId === product.variantId ? { ...item, quantity: item.quantity + 1 } : item
            )
            : [...items, { ...product, quantity: 1 }];

        writeCartStorage({
            items: nextItems,
            coupon: defaultCouponState,
        });
        setCartOpen(true);
    };

    const removeItem = (variantId: number) => {
        writeCartStorage({
            items: items.filter(item => item.variantId !== variantId),
            coupon: defaultCouponState,
        });
    };

    const updateQuantity = (variantId: number, quantity: number) => {
        if (quantity < 1) return removeItem(variantId);

        writeCartStorage({
            items: items.map(item =>
                item.variantId === variantId ? { ...item, quantity } : item
            ),
            coupon: defaultCouponState,
        });
    };

    const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    return (
        <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, coupon, setCoupon, clearCoupon, totalAmount, isCartOpen, setCartOpen }}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const context = useContext(CartContext);
    if (context === undefined) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
}
