"use client";

import Image from 'next/image';
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Star, ShieldCheck, Truck, RotateCcw, Plus, Minus } from 'lucide-react';
import { Product } from '@/types/shop';
import { useCart } from '@/context/CartContext';
import { sanitizeRichHtml } from '@/lib/sanitize-rich-html';
import { Breadcrumbs } from './Breadcrumbs';

interface ProductDetailsProps {
    product: Product;
}

export function ProductDetails({ product }: ProductDetailsProps) {
    const rawDescription = product.description?.trim();
    const descriptionMarkup = sanitizeRichHtml(rawDescription
        ? ((rawDescription.includes('<') && rawDescription.includes('>'))
            ? rawDescription
            : rawDescription.replace(/\n/g, '<br/>'))
        : '');

    const displaySpecs = product.specs || [];

    const allSections = [
        { id: 'description', label: 'Description' },
        { id: 'specs', label: 'Technical Specs' },
        { id: 'shipping', label: 'Shipping & Returns' },
    ];

    const sections = allSections.filter(section => {
        if (section.id === 'description') return !!descriptionMarkup;
        return true; // specs and shipping always show
    });

    const [quantity, setQuantity] = useState(1);
    const [openSection, setOpenSection] = useState<string | null>(sections[0]?.id ?? null);
    const toggleSection = (id: string) => setOpenSection((current) => (current === id ? null : id));
    const { addItem } = useCart();

    const options = product.options ?? [];
    const variants = product.variants ?? [];

    const initialVariant = variants.find((v) => v.id === product.variantId) ?? variants[0] ?? null;
    const initialSelections: Record<string, number> = {};
    initialVariant?.options.forEach((opt) => {
        if (opt.option) initialSelections[opt.option] = opt.valueId;
    });

    const [selectedValues, setSelectedValues] = useState<Record<string, number>>(initialSelections);

    const selectedVariant = variants.find((v) =>
        v.options.every((opt) => !opt.option || selectedValues[opt.option] === opt.valueId)
    ) ?? initialVariant;

    const displayPrice = selectedVariant?.price ?? product.price;
    const displayOldPrice = selectedVariant?.comparePrice ?? product.oldPrice;
    const galleryImages = (product.images && product.images.length > 0)
        ? product.images
        : [{ id: null, src: product.image, alt: product.name }];

    const variantImageIndex = selectedVariant?.image
        ? galleryImages.findIndex((img) => img.src === selectedVariant.image)
        : -1;

    const [activeImageIndex, setActiveImageIndex] = useState(0);

    const displayImage = variantImageIndex >= 0
        ? galleryImages[variantImageIndex].src
        : (galleryImages[activeImageIndex]?.src ?? product.image);

    const isAvailable = selectedVariant ? selectedVariant.available : true;

    return (
        <div className="bg-white">
            <Breadcrumbs category={product.category} categorySlug={product.categorySlug} productName={product.name} />

            <section className="px-4 pb-24 pt-4 md:px-8">
                <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-start gap-16 md:gap-24 lg:grid-cols-2">
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="relative lg:sticky lg:top-24"
                    >
                        <div className="flex flex-col gap-3 md:flex-row">
                            {galleryImages.length > 1 && (
                                <div className="order-2 flex gap-3 overflow-x-auto md:order-1 md:flex-col md:overflow-visible">
                                    {galleryImages.map((img, idx) => (
                                        <button
                                            key={img.id ?? idx}
                                            type="button"
                                            onClick={() => setActiveImageIndex(idx)}
                                            className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-white transition-colors ${displayImage === img.src ? 'border-secondary' : 'border-zinc-100 hover:border-zinc-300'
                                                }`}
                                        >
                                            <Image
                                                src={img.src}
                                                alt={img.alt || product.name}
                                                fill
                                                sizes="64px"
                                                className="object-cover"
                                            />
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div className="relative order-1 aspect-square w-full max-w-[480px] overflow-hidden rounded-2xl border border-zinc-100 bg-white md:order-2">
                                <Image
                                    src={displayImage}
                                    alt={product.name}
                                    fill
                                    sizes="(max-width: 1024px) 100vw, 480px"
                                    className="object-contain p-8"
                                />
                                {product.badge && (
                                    <span className="absolute left-6 top-6 rounded-[2px] bg-secondary px-4 py-1.5 text-xs font-black uppercase tracking-widest text-ink shadow-xl shadow-orange-500/20">
                                        {product.badge}
                                    </span>
                                )}
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex flex-col"
                    >
                        <div className="mb-8">
                            <p className="mb-4 text-xs font-black capitalize tracking-[0.05em] text-primary">
                                {product.category} Essentials
                            </p>
                            <h1 className="mb-1 text-[30px] font-bold leading-[1.1] text-primary">
                                {product.name}
                            </h1>
                            <p className="mb-6 text-sm text-zinc-500">
                                By <span className="font-semibold text-primary">{product.brand || 'PetPosture'}</span>
                            </p>

                            <div className="mb-8 flex items-center gap-6">
                                <div className="flex items-center gap-1.5">
                                    {[...Array(5)].map((_, i) => (
                                        <Star
                                            key={i}
                                            size={14}
                                            className={product.reviews > 0 && i < product.rating ? 'fill-secondary text-rust' : 'text-zinc-200'}
                                        />
                                    ))}
                                    <span className="ml-1 text-xs font-bold text-zinc-400">
                                        {product.reviews > 0 ? `(${product.reviews} Verified)` : 'No reviews yet'}
                                    </span>
                                </div>
                            </div>

                            <div className="mb-4 flex items-baseline gap-4">
                                <span className="text-[32px] font-bold text-primary">${displayPrice.toFixed(2)}</span>
                                {displayOldPrice && (
                                    <span className="text-[20px] font-medium text-zinc-300 line-through">${displayOldPrice.toFixed(2)}</span>
                                )}
                            </div>
                        </div>

                        {options.length > 0 && (
                            <div className="mb-8 space-y-6">
                                {options.map((option) => (
                                    <div key={option.id}>
                                        <p className="mb-3 text-base font-black capitalize tracking-[0.05em] text-primary">
                                            {option.name}
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {option.values.map((value) => {
                                                const isSelected = selectedValues[option.name] === value.id;
                                                return (
                                                    <button
                                                        key={value.id}
                                                        type="button"
                                                        onClick={() =>
                                                            setSelectedValues((prev) => ({ ...prev, [option.name]: value.id }))
                                                        }
                                                        className={`rounded-[4px] border-2 px-4 py-2 text-sm font-bold uppercase tracking-wide transition-colors ${isSelected
                                                            ? 'border-secondary bg-secondary text-ink'
                                                            : 'border-zinc-200 bg-white text-primary hover:border-secondary'
                                                            }`}
                                                    >
                                                        {value.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="mb-12 space-y-6 rounded-2xl border border-zinc-100 bg-zinc-50 p-8 shadow-sm shadow-zinc-200/20">
                            <div className="flex flex-col gap-5">
                                <div className="flex items-center gap-6">
                                    <div className="flex h-[54px] items-center rounded-[4px] border-2 border-white bg-white shadow-sm">
                                        <button
                                            onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                            className="flex h-full items-center px-3 text-zinc-400 transition-colors hover:text-primary"
                                        >
                                            -
                                        </button>
                                        <span className="w-10 text-center font-bold text-primary">{quantity}</span>
                                        <button
                                            onClick={() => setQuantity(quantity + 1)}
                                            className="flex h-full items-center px-3 text-zinc-400 transition-colors hover:text-primary"
                                        >
                                            +
                                        </button>
                                    </div>
                                    <div className="flex flex-col">
                                        <div className={`flex items-center gap-2 text-sm font-bold capitalize tracking-wider ${isAvailable ? 'text-green-600' : 'text-zinc-400'}`}>
                                            <ShieldCheck size={18} /> {isAvailable ? 'In Stock' : 'Out of Stock'}
                                        </div>
                                        <p className="mt-1 text-xs text-zinc-500">Free shipping on orders over $50</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        const itemToAdd = selectedVariant
                                            ? {
                                                ...product,
                                                variantId: selectedVariant.id,
                                                price: selectedVariant.price,
                                                oldPrice: selectedVariant.comparePrice ?? product.oldPrice,
                                                image: selectedVariant.image || product.image,
                                            }
                                            : product;
                                        for (let i = 0; i < quantity; i++) addItem(itemToAdd);
                                    }}
                                    disabled={!isAvailable}
                                    className="h-[54px] w-full rounded-[4px] bg-secondary text-base font-black uppercase tracking-[0.12em] text-ink shadow-xl shadow-orange-500/20 transition-all duration-500 hover:bg-secondary-dark disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    {isAvailable ? 'Add to cart' : 'Out of stock'}
                                </button>
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-zinc-400">
                                    <Truck size={14} className="text-rust" /> Free Express Shipping
                                </div>
                                <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-zinc-400">
                                    <RotateCcw size={14} className="text-rust" /> 30-Day Health Trial
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 divide-y divide-zinc-100 border-t border-zinc-100">
                            {sections.map((section) => {
                                const isOpen = openSection === section.id;
                                return (
                                    <div key={section.id}>
                                        <button
                                            type="button"
                                            onClick={() => toggleSection(section.id)}
                                            aria-expanded={isOpen}
                                            className="flex w-full items-center justify-between py-5 text-left text-sm font-black uppercase tracking-wide text-primary"
                                        >
                                            {section.label}
                                            {isOpen ? <Minus size={18} className="text-rust" /> : <Plus size={18} className="text-zinc-300" />}
                                        </button>

                                        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[1000px] opacity-100 pb-6' : 'max-h-0 opacity-0'}`}>
                                            {section.id === 'description' && (
                                                <div
                                                    className="prose prose-zinc max-w-none text-[15px] leading-[1.8] text-zinc-500 prose-headings:text-primary prose-p:my-0 prose-p:leading-[1.8]"
                                                    dangerouslySetInnerHTML={{ __html: descriptionMarkup }}
                                                />
                                            )}
                                            {section.id === 'specs' && (
                                                <div className="grid grid-cols-1 gap-4">
                                                    {(displaySpecs && displaySpecs.length > 0) ? (
                                                        displaySpecs.map((spec, i) => (
                                                            <div key={i} className="flex justify-between border-b border-zinc-50 py-3 text-sm">
                                                                <span className="font-bold capitalize tracking-wide text-primary">{spec.label}</span>
                                                                <span className="text-zinc-500">{spec.value}</span>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <p className="text-zinc-400 text-sm">No technical specifications available for this product yet.</p>
                                                    )}
                                                </div>
                                            )}
                                            {section.id === 'shipping' && (
                                                <div className="space-y-6">
                                                    <div>
                                                        <h4 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary">
                                                            <Truck size={16} className="text-rust" /> Shipping
                                                        </h4>
                                                        <ul className="space-y-3 text-[15px] leading-[1.8] text-zinc-500">
                                                            <li className="flex items-start gap-3">
                                                                <div className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-secondary" />
                                                                <span>Free standard shipping for all US orders over $50; express 2-day delivery available at checkout.</span>
                                                            </li>
                                                            <li className="flex items-start gap-3">
                                                                <div className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-secondary" />
                                                                <span>Orders are processed within 2–4 business days, then arrive in 7–10 business days total (US only).</span>
                                                            </li>
                                                            <li className="flex items-start gap-3">
                                                                <div className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-secondary" />
                                                                <span>You&apos;ll get a tracking number by email as soon as your order ships.</span>
                                                            </li>
                                                        </ul>
                                                        <a href="/shipping-policy" className="mt-3 inline-block text-sm font-bold text-rust hover:underline">
                                                            Read the full Shipping Policy →
                                                        </a>
                                                    </div>

                                                    <div className="border-t border-zinc-100 pt-6">
                                                        <h4 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary">
                                                            <RotateCcw size={16} className="text-rust" /> Returns
                                                        </h4>
                                                        <ul className="space-y-3 text-[15px] leading-[1.8] text-zinc-500">
                                                            <li className="flex items-start gap-3">
                                                                <div className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-secondary" />
                                                                <span>30-day return window from delivery, for items in original, unused condition with all packaging and tags.</span>
                                                            </li>
                                                            <li className="flex items-start gap-3">
                                                                <div className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-secondary" />
                                                                <span>A 25% restocking fee applies to standard returns; original shipping costs aren&apos;t refunded.</span>
                                                            </li>
                                                            <li className="flex items-start gap-3">
                                                                <div className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-secondary" />
                                                                <span>Damaged or defective items reported within 7 days ship back free, no restocking fee.</span>
                                                            </li>
                                                        </ul>
                                                        <a href="/return-refund-policy" className="mt-3 inline-block text-sm font-bold text-rust hover:underline">
                                                            Read the full Return &amp; Refund Policy →
                                                        </a>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                </div>
            </section>
        </div>
    );
}
