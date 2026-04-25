import React from 'react';
import { Star, ArrowUpRight, ShoppingBag } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import type { Product } from '@/types/shop';

export function ProductCard({ product }: { product: Product }) {
    const { addItem } = useCart();

    return (
        <article className="group overflow-hidden rounded-[20px] border border-[#eee3d7] bg-[#fcfbf8] shadow-[0_12px_28px_rgba(34,33,33,0.04)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_36px_rgba(34,33,33,0.08)]">
            <Link href={`/shop/${product.categorySlug}/${product.slug}`} className="block">
                <div className="relative aspect-square overflow-hidden border-b border-[#efe5dc] bg-[#f4eee7]">
                    <Image
                        src={product.image}
                        alt={product.name}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="transition duration-500 group-hover:scale-[1.03]"
                    />

                    <div className="absolute left-3 top-3">
                        <span className="rounded-full bg-white/92 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[#56616a] shadow-sm">
                            {product.category}
                        </span>
                    </div>

                    <div className="absolute right-3 top-3 flex flex-col items-end gap-2">
                        {product.badge && (
                            <span className="rounded-full bg-[#df8448] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-white shadow-lg shadow-orange-500/20">
                                {product.badge}
                            </span>
                        )}
                        {product.isNew && (
                            <span className="rounded-full bg-[#3e4c57] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-white shadow-lg shadow-zinc-500/20">
                                New
                            </span>
                        )}
                        {product.lowStockWarning && !product.backorder && (
                            <span className="rounded-full bg-[#d94e33] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-white shadow-lg shadow-red-500/20">
                                Low Stock
                            </span>
                        )}
                        {product.backorder && (
                            <span className="rounded-full bg-[#6b7280] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-white shadow-lg shadow-zinc-500/20">
                                Backorder
                            </span>
                        )}
                    </div>
                </div>
            </Link>

            <div className="p-4">
                <div className="mb-2 flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                        <Star
                            key={i}
                            size={11}
                            className={i < product.rating ? "fill-[#df8448] text-[#df8448]" : "text-zinc-200"}
                        />
                    ))}
                    <span className="ml-1 text-[10px] font-medium text-[#8b8f93]">{product.reviews} reviews</span>
                </div>

                <Link href={`/shop/${product.categorySlug}/${product.slug}`} className="block">
                    <h3 className="line-clamp-2 min-h-[48px] text-[16px] font-semibold leading-6 text-[#2d3a43] transition-colors group-hover:text-[#df8448]">
                        {product.name}
                    </h3>
                </Link>

                <div className="mt-3 flex items-end justify-between gap-3">
                    <div className="flex items-center gap-3 font-bold">
                        <span className="text-[16px] text-[#df8448]">${product.price.toFixed(2)}</span>
                        {product.oldPrice != null && (
                            <span className="text-[12px] font-medium text-zinc-300 line-through">${product.oldPrice.toFixed(2)}</span>
                        )}
                    </div>

                    <Link
                        href={`/shop/${product.categorySlug}/${product.slug}`}
                        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#54646e] transition hover:text-[#df8448]"
                    >
                        View <ArrowUpRight size={14} />
                    </Link>
                </div>

                <button
                    onClick={() => addItem(product)}
                    className="mt-4 inline-flex h-[46px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#2f3d46] px-4 text-[11px] font-bold uppercase tracking-[0.16em] text-white transition hover:bg-[#df8448]"
                >
                    <ShoppingBag size={15} />
                    Add to Cart
                </button>
            </div>
        </article>
    );
}
