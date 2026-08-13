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
        <nav className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-zinc-400 py-8 px-4 md:px-8 max-w-[1200px] mx-auto">
            <Link href="/" className="shrink-0 hover:text-secondary-dark transition-colors flex items-center gap-1">
                <Home size={12} />
                <span>Home</span>
            </Link>

            <ChevronRight size={13} className="shrink-0 text-zinc-300" />

            <Link href="/shop" className="shrink-0 hover:text-secondary-dark transition-colors">
                Shop
            </Link>

            {category && !isCategoryGeneric && (
                <>
                    <ChevronRight size={13} className="shrink-0 text-zinc-300" />
                    <Link href={`/shop/${categorySlug || 'categories'}`} className="shrink-0 hover:text-secondary-dark transition-colors">
                        {category}
                    </Link>
                </>
            )}

            {productName && (
                <>
                    <ChevronRight size={13} className="shrink-0 text-zinc-300" />
                    <span className="min-w-0 truncate text-primary">
                        {productName}
                    </span>
                </>
            )}
        </nav>
    );
}
