"use client";

import React, { useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useCart } from '@/context/CartContext';
import { useRouter } from 'next/navigation';
import { CheckCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function CheckoutPage() {
    const { items, totalAmount, setCartOpen } = useCart();
    const { token } = useAuth();
    const router = useRouter();
    const [address, setAddress] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [successId, setSuccessId] = useState<number | null>(null);

    const handleCheckout = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const res = await fetch('http://127.0.0.1:8000/api/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    items: items.map(i => ({ productId: i.id, quantity: i.quantity })),
                    shipping: { address },
                    totalAmount
                })
            });

            const data = await res.json();
            if (data.success) {
                // Clear cart (via localStorage hack here, or context method realistically. Let's just remove from localStorage to force empty state, or real app should have clearCart)
                localStorage.removeItem('petposture_cart');
                setSuccessId(data.order_id);
            } else {
                alert("Checkout failed: " + data.message);
            }
        } catch (err) {
            console.error(err);
            alert("Network error processing your checkout.");
        } finally {
            setIsLoading(false);
        }
    };

    if (successId) {
        return (
            <main className="min-h-screen bg-white font-hanken flex flex-col">
                <Header />
                <div className="flex-1 flex flex-col items-center justify-center p-8 bg-zinc-50">
                    <CheckCircle size={64} className="text-green-500 mb-6" />
                    <h1 className="text-[32px] font-bold text-[#3e4c57] mb-4">Order Successful!</h1>
                    <p className="text-zinc-500 mb-8">Your order #{successId} has been securely placed.</p>
                    <button
                        onClick={() => {
                            window.location.href = '/shop';
                        }}
                        className="bg-[#df8448] text-white px-8 py-4 rounded-[4px] font-black uppercase tracking-widest text-[12px] hover:bg-[#c9713a] transition-all"
                    >
                        Continue Shopping
                    </button>
                </div>
                <Footer />
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-white font-hanken flex flex-col">
            <Header />
            <div className="flex-1 max-w-[1000px] w-full mx-auto p-4 md:p-8 flex flex-col md:flex-row gap-8 lg:gap-16 my-8">
                {/* Checkout Form */}
                <div className="flex-1">
                    <h1 className="text-[28px] font-bold text-[#3e4c57] mb-8 uppercase tracking-widest">
                        Secure Checkout
                    </h1>
                    <form onSubmit={handleCheckout} className="space-y-6">
                        <div>
                            <label className="block text-[13px] font-bold text-[#3e4c57] uppercase tracking-wider mb-2">
                                Shipping Address
                            </label>
                            <textarea
                                required
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                className="w-full bg-zinc-50 border border-zinc-200 rounded-[4px] p-4 text-[14px] outline-none focus:border-[#df8448] transition-colors"
                                rows={4}
                                placeholder="123 Example Street, Apt 4B..."
                            ></textarea>
                        </div>

                        <button
                            disabled={isLoading || items.length === 0}
                            className="w-full bg-[#3e4c57] text-white py-4 rounded-[4px] font-black uppercase tracking-[0.2em] text-[13px] hover:bg-[#2c363e] disabled:opacity-50 transition-all"
                        >
                            {isLoading ? 'Processing...' : `Place Order • $${totalAmount.toFixed(2)}`}
                        </button>
                    </form>
                </div>

                {/* Cart Summary Snippet */}
                <div className="w-full md:w-[350px] lg:w-[400px] bg-zinc-50 p-6 rounded-xl border border-zinc-100 h-fit">
                    <h2 className="text-[14px] font-bold text-[#3e4c57] uppercase tracking-wider mb-6 pb-4 border-b border-zinc-200">
                        Order Summary
                    </h2>
                    <div className="space-y-4 mb-6">
                        {items.map(item => (
                            <div key={item.id} className="flex gap-4">
                                <div className="w-16 h-16 bg-white rounded border border-zinc-100 overflow-hidden flex-shrink-0">
                                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-[12px] font-bold text-[#3e4c57] leading-tight">{item.name}</h3>
                                    <p className="text-zinc-400 text-[11px] mt-1">Qty: {item.quantity}</p>
                                    <p className="text-[#df8448] font-bold text-[13px] mt-1">${(item.price * item.quantity).toFixed(2)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <Footer />
        </main>
    );
}
