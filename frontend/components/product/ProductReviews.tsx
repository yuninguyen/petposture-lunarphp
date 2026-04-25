"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Star, MessageSquare, ShieldCheck, User, Send } from 'lucide-react';
import { Product } from '@/types/shop';
import { getApiBaseUrl } from '@/lib/api';

interface Review {
    id: number;
    customer_name: string;
    rating: number;
    comment: string;
    is_verified: boolean;
    created_at: string;
}

interface ProductReviewsProps {
    product: Product;
}

export function ProductReviews({ product }: ProductReviewsProps) {
    const [reviews, setReviews] = useState<Review[]>([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Form state
    const [formData, setFormData] = useState({
        customer_name: '',
        rating: 5,
        comment: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchReviews = useCallback(async () => {
        try {
            const backendHost = getApiBaseUrl();
            const res = await fetch(`${backendHost}/api/products/${product.slug}/reviews`);
            const data = await res.json();
            setReviews(data.data || []);
        } catch (err) {
            console.error('Failed to fetch reviews', err);
        } finally {
            setIsLoading(false);
        }
    }, [product.slug]);

    useEffect(() => {
        fetchReviews();
    }, [fetchReviews]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const backendHost = getApiBaseUrl();
            const res = await fetch(`${backendHost}/api/products/${product.slug}/reviews`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            if (res.ok) {
                setFormData({ customer_name: '', rating: 5, comment: '' });
                setIsFormOpen(false);
                fetchReviews();
            }
        } catch (err) {
            console.error('Failed to submit review', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const averageRating = reviews.length > 0
        ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
        : "5.0";

    return (
        <section className="py-24 px-4 md:px-8 bg-[#fdfdfd] border-t border-zinc-100">
            <div className="max-w-[1200px] mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">

                    {/* Summary Side */}
                    <div className="lg:col-span-1">
                        <h2 className="text-[#3e4c57] text-[12px] font-black uppercase tracking-[0.4em] mb-4">Patient Feedback</h2>
                        <h3 className="text-[#3e4c57] text-[32px] font-bold leading-tight uppercase mb-8">USER JOURNEYS</h3>

                        <div className="bg-white p-10 rounded-3xl border border-zinc-100 shadow-xl shadow-zinc-200/20 mb-8">
                            <div className="text-center">
                                <span className="text-[64px] font-black text-[#3e4c57] leading-none">{averageRating}</span>
                                <div className="flex justify-center gap-1.5 my-4">
                                    {[...Array(5)].map((_, i) => (
                                        <Star key={i} size={18} className={i < Math.round(Number(averageRating)) ? "text-[#df8448] fill-[#df8448]" : "text-zinc-100"} />
                                    ))}
                                </div>
                                <p className="text-zinc-400 text-[11px] font-bold uppercase tracking-widest">Based on {reviews.length} Verified Owners</p>
                            </div>

                            <button
                                onClick={() => setIsFormOpen(!isFormOpen)}
                                className="w-full mt-10 bg-[#3e4c57] text-white py-4 rounded-[4px] text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-[#df8448] transition-all"
                            >
                                {isFormOpen ? 'Cancel Review' : 'Write a Review'}
                            </button>
                        </div>

                        <div className="space-y-4">
                            {[5, 4, 3, 2, 1].map(star => (
                                <div key={star} className="flex items-center gap-4">
                                    <span className="text-[10px] font-bold text-zinc-400 w-4">{star}</span>
                                    <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-[#df8448] rounded-full"
                                            style={{ width: `${reviews.length > 0 ? (reviews.filter(r => r.rating === star).length / reviews.length) * 100 : 0}%` }}
                                        />
                                    </div>
                                    <span className="text-[10px] font-bold text-zinc-300 w-8">{reviews.filter(r => r.rating === star).length}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Review List & Form */}
                    <div className="lg:col-span-2">
                        {isFormOpen ? (
                                <div className="bg-white p-12 rounded-3xl border border-zinc-100 shadow-2xl shadow-zinc-200/30 mb-12">
                                    <h4 className="text-[#3e4c57] text-[20px] font-bold mb-8 uppercase tracking-wide">Share your pet&apos;s journey</h4>
                                    <form onSubmit={handleSubmit} className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Customer Name</label>
                                                <input
                                                    required
                                                    type="text"
                                                    value={formData.customer_name}
                                                    onChange={e => setFormData({ ...formData, customer_name: e.target.value })}
                                                    className="w-full bg-zinc-50 border-none rounded-lg p-4 text-[#3e4c57] font-bold text-[14px] focus:ring-2 focus:ring-[#df8448]/20 outline-none"
                                                    placeholder="e.g. Sarah J."
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Biometric Rating</label>
                                                <div className="flex gap-2">
                                                    {[1, 2, 3, 4, 5].map(star => (
                                                        <button
                                                            key={star}
                                                            type="button"
                                                            onClick={() => setFormData({ ...formData, rating: star })}
                                                            className={`p-2 rounded-lg transition-colors ${formData.rating >= star ? 'text-[#df8448]' : 'text-zinc-200'}`}
                                                        >
                                                            <Star size={24} fill={formData.rating >= star ? 'currentColor' : 'none'} />
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Professional Feedback</label>
                                            <textarea
                                                required
                                                rows={4}
                                                value={formData.comment}
                                                onChange={e => setFormData({ ...formData, comment: e.target.value })}
                                                className="w-full bg-zinc-50 border-none rounded-lg p-4 text-[#3e4c57] font-bold text-[14px] focus:ring-2 focus:ring-[#df8448]/20 outline-none resize-none"
                                                placeholder="Tell us how it improved your pet's posture..."
                                            />
                                        </div>
                                        <button
                                            disabled={isSubmitting}
                                            type="submit"
                                            className="bg-[#df8448] text-white px-10 py-5 rounded-[4px] text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-[#c9713a] transition-all flex items-center gap-3 disabled:opacity-50"
                                        >
                                            {isSubmitting ? 'Transmitting...' : (
                                                <>Submit for Verification <Send size={14} /></>
                                            )}
                                        </button>
                                    </form>
                                </div>
                            ) : null}

                        <div className="space-y-8">
                            {isLoading ? (
                                <div className="text-center py-20">
                                    <div className="w-8 h-8 border-4 border-[#df8448] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                    <p className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">Retrieving Social Proof...</p>
                                </div>
                            ) : reviews.length === 0 ? (
                                <div className="bg-white p-12 rounded-3xl border border-zinc-100 text-center">
                                    <MessageSquare size={32} className="mx-auto text-zinc-100 mb-6" />
                                    <p className="text-zinc-400 font-bold uppercase tracking-widest text-[11px]">No journeys shared yet. Be the first to lead the pack.</p>
                                </div>
                            ) : (
                                reviews.map((review) => (
                                    <div
                                        key={review.id}
                                        className="bg-white p-10 rounded-3xl border border-zinc-100 shadow-sm hover:shadow-xl hover:shadow-zinc-200/20 transition-all group"
                                    >
                                        <div className="flex items-center justify-between mb-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-zinc-50 rounded-full flex items-center justify-center text-zinc-300 group-hover:bg-[#df8448]/10 group-hover:text-[#df8448] transition-colors">
                                                    <User size={20} />
                                                </div>
                                                <div>
                                                    <h5 className="text-[14px] font-black uppercase tracking-wide text-[#3e4c57]">{review.customer_name}</h5>
                                                    <div className="flex items-center gap-2 text-[10px] font-bold text-green-500 uppercase tracking-widest mt-1">
                                                        <ShieldCheck size={12} /> Verified Owner
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-1">
                                                {[...Array(5)].map((_, i) => (
                                                    <Star key={i} size={14} className={i < review.rating ? "text-[#df8448] fill-[#df8448]" : "text-zinc-100"} />
                                                ))}
                                            </div>
                                        </div>
                                        <p className="text-zinc-500 text-[15px] leading-relaxed italic">&quot;{review.comment}&quot;</p>
                                        <div className="mt-6 pt-6 border-t border-zinc-50 text-[10px] font-bold text-zinc-300 uppercase tracking-widest">
                                            {new Date(review.created_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
