import React from 'react';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { Product } from '@/types/shop';
import { useCart } from '@/context/CartContext';
import Link from 'next/link';

interface ProductCardProps {
    product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
    const { addItem } = useCart();

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="group"
        >
            <div className="relative aspect-[4/5] bg-[#f8f9fa] rounded-2xl overflow-hidden mb-6 border border-zinc-50 shadow-sm group-hover:shadow-2xl group-hover:shadow-zinc-200 transition-all duration-500">
                <Link href={`/product/${product.id}`}>
                    <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 cursor-pointer"
                    />
                </Link>

                {/* Badges */}
                <div className="absolute top-4 left-4 flex flex-col gap-2">
                    {product.badge && (
                        <span className="bg-[#df8448] text-white text-[9px] font-black px-3 py-1 rounded-[2px] uppercase tracking-widest shadow-lg shadow-orange-500/20">
                            {product.badge}
                        </span>
                    )}
                    {product.isNew && (
                        <span className="bg-[#3e4c57] text-white text-[9px] font-black px-3 py-1 rounded-[2px] uppercase tracking-widest shadow-lg shadow-zinc-500/20">
                            NEW ARRIVAL
                        </span>
                    )}
                </div>

                {/* Action Overlay */}
                <div className="absolute inset-x-0 bottom-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-500 flex flex-col gap-2">
                    <button
                        onClick={() => addItem(product)}
                        className="w-full bg-[#df8448] text-white py-4 rounded-[4px] text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-[#c9713a] transition-all"
                    >
                        Add to Cart
                    </button>
                </div>
            </div>

            <div className="px-1 text-center">
                <div className="flex items-center justify-center gap-1 mb-3">
                    {[...Array(5)].map((_, i) => (
                        <Star
                            key={i}
                            size={10}
                            className={i < product.rating ? "text-[#df8448] fill-[#df8448]" : "text-zinc-200"}
                        />
                    ))}
                    <span className="text-[10px] text-zinc-400 font-bold ml-1">({product.reviews})</span>
                </div>
                <Link href={`/product/${product.id}`}>
                    <h3 className="text-[13px] font-bold text-[#3e4c57] uppercase tracking-wide mb-3 leading-tight group-hover:text-[#df8448] transition-colors cursor-pointer">
                        {product.name}
                    </h3>
                </Link>
                <div className="flex items-center justify-center gap-3 font-bold">
                    <span className="text-[#df8448] text-[15px]">${product.price.toFixed(2)}</span>
                    {product.oldPrice && (
                        <span className="text-zinc-300 text-[13px] line-through font-medium">${product.oldPrice.toFixed(2)}</span>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
