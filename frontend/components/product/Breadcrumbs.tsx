"use client";

import React from 'react';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbsProps {
    category?: string;
    categorySlug?: string;
    productName?: string;
}

export function Breadcrumbs({ category, categorySlug, productName }: BreadcrumbsProps) {
    const isCategoryGeneric = category?.toLowerCase() === 'shop' || category?.toLowerCase() === 'categories';

    return (
        <nav className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-zinc-400 py-8 px-4 md:px-8 max-w-[1200px] mx-auto">
            <Link href="/" className="hover:text-[#df8448] transition-colors flex items-center gap-1">
                <Home size={12} />
                <span>Home</span>
            </Link>

            <ChevronRight size={12} className="opacity-30" />

            <Link href="/shop" className="hover:text-[#df8448] transition-colors">
                Shop
            </Link>

            {category && !isCategoryGeneric && (
                <>
                    <ChevronRight size={12} className="opacity-30" />
                    <Link href={`/shop/${categorySlug || 'categories'}`} className="hover:text-[#df8448] transition-colors">
                        {category}
                    </Link>
                </>
            )}

            {productName && (
                <>
                    <ChevronRight size={12} className="opacity-30" />
                    <span className="text-[#3e4c57] truncate max-w-[200px] md:max-w-none">
                        {productName}
                    </span>
                </>
            )}
        </nav>
    );
}
