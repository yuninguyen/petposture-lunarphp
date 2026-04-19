"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Product } from '@/types/shop';

interface CartItem extends Product {
    quantity: number;
}

interface CartContextType {
    items: CartItem[];
    addItem: (product: Product) => void;
    removeItem: (id: number) => void;
    updateQuantity: (id: number, quantity: number) => void;
    totalAmount: number;
    isCartOpen: boolean;
    setCartOpen: (isOpen: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<CartItem[]>([]);
    const [isCartOpen, setCartOpen] = useState(false);

    // Simple persistence with localStorage
    useEffect(() => {
        const savedCart = localStorage.getItem('petposture_cart');
        if (savedCart) {
            try {
                setItems(JSON.parse(savedCart));
            } catch (e) {
                console.error("Failed to parse cart", e);
            }
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('petposture_cart', JSON.stringify(items));
    }, [items]);

    const addItem = (product: Product) => {
        setItems(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                return prev.map(item =>
                    item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
                );
            }
            return [...prev, { ...product, quantity: 1 }];
        });
        setCartOpen(true);
    };

    const removeItem = (id: number) => {
        setItems(prev => prev.filter(item => item.id !== id));
    };

    const updateQuantity = (id: number, quantity: number) => {
        if (quantity < 1) return removeItem(id);
        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, quantity } : item
        ));
    };

    const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    return (
        <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, totalAmount, isCartOpen, setCartOpen }}>
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
