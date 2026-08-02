"use client";

import Image from 'next/image';
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Star, ShieldCheck, Truck, RotateCcw, Plus, Minus } from 'lucide-react';
import { Product } from '@/types/shop';
import { useCart } from '@/context/CartContext';
import { Breadcrumbs } from './Breadcrumbs';

interface ProductDetailsProps {
    product: Product;
}

export function ProductDetails({ product }: ProductDetailsProps) {
    const [quantity, setQuantity] = useState(1);
    const [openSection, setOpenSection] = useState<string | null>('description');
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
    const descriptionMarkup = product.description?.trim()
        ? (product.description.includes('<') ? product.description : `<p>${product.description}</p>`)
        : '<p>Expertly crafted for superior spinal alignment and long-term pet health.</p>';

    const sections = [
        { id: 'description', label: 'Description' },
        { id: 'specs', label: 'Technical Specs' },
        { id: 'shipping', label: 'Shipping & Returns' },
    ];

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
                        <div className="flex gap-3">
                            {galleryImages.length > 1 && (
                                <div className="flex flex-col gap-3">
                                    {galleryImages.map((img, idx) => (
                                        <button
                                            key={img.id ?? idx}
                                            type="button"
                                            onClick={() => setActiveImageIndex(idx)}
                                            className={`relative h-16 w-16 overflow-hidden rounded-lg border-2 bg-white transition-colors ${displayImage === img.src ? 'border-[#df8448]' : 'border-zinc-100 hover:border-zinc-300'
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

                            <div className="relative aspect-square w-full max-w-[480px] overflow-hidden rounded-2xl border border-zinc-100 bg-white">
                                <Image
                                    src={displayImage}
                                    alt={product.name}
                                    fill
                                    sizes="(max-width: 1024px) 100vw, 480px"
                                    className="object-contain"
                                />
                                {product.badge && (
                                    <span className="absolute left-6 top-6 rounded-[2px] bg-[#df8448] px-4 py-1.5 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-orange-500/20">
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
                            <p className="mb-4 text-xs font-black uppercase tracking-[0.15em] text-[#df8448]">
                                {product.category} Ergonomics
                            </p>
                            <h1 className="mb-6 text-[32px] font-bold leading-[1.1] text-[#3e4c57] md:text-[44px]">
                                {product.name}
                            </h1>

                            <div className="mb-8 flex items-center gap-6">
                                <div className="flex items-center gap-1.5">
                                    {[...Array(5)].map((_, i) => (
                                        <Star
                                            key={i}
                                            size={14}
                                            className={i < product.rating ? 'fill-[#df8448] text-[#df8448]' : 'text-zinc-200'}
                                        />
                                    ))}
                                    <span className="ml-1 text-xs font-bold text-zinc-400">({product.reviews} Verified)</span>
                                </div>
                                <div className="h-4 w-px bg-zinc-100"></div>
                                <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest ${isAvailable ? 'text-green-600' : 'text-zinc-400'}`}>
                                    <ShieldCheck size={14} /> {isAvailable ? 'In Stock' : 'Out of Stock'}
                                </div>
                            </div>

                            <div className="mb-4 flex items-baseline gap-4">
                                <span className="text-[32px] font-bold text-[#df8448]">${displayPrice.toFixed(2)}</span>
                                {displayOldPrice && (
                                    <span className="text-[20px] font-medium text-zinc-300 line-through">${displayOldPrice.toFixed(2)}</span>
                                )}
                            </div>
                        </div>

                        {options.length > 0 && (
                            <div className="mb-8 space-y-6">
                                {options.map((option) => (
                                    <div key={option.id}>
                                        <p className="mb-3 text-base font-black capitalize tracking-[0.05em] text-[#3e4c57]">
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
                                                                ? 'border-[#df8448] bg-[#df8448] text-white'
                                                                : 'border-zinc-200 bg-white text-[#3e4c57] hover:border-[#df8448]'
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
                            <div className="flex items-center gap-4">
                                <div className="flex items-center rounded-[4px] border-2 border-white bg-white shadow-sm">
                                    <button
                                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                        className="px-4 py-3 text-zinc-400 transition-colors hover:text-[#3e4c57]"
                                    >
                                        -
                                    </button>
                                    <span className="w-12 text-center font-bold text-[#3e4c57]">{quantity}</span>
                                    <button
                                        onClick={() => setQuantity(quantity + 1)}
                                        className="px-4 py-3 text-zinc-400 transition-colors hover:text-[#3e4c57]"
                                    >
                                        +
                                    </button>
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
                                    className="h-[54px] flex-1 rounded-[4px] bg-[#df8448] text-sm font-black uppercase tracking-[0.12em] text-white shadow-xl shadow-orange-500/20 transition-all duration-500 hover:bg-[#c9713a] disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    {isAvailable ? 'Add to cart' : 'Out of stock'}
                                </button>
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-zinc-400">
                                    <Truck size={14} className="text-[#df8448]" /> Free Express Shipping
                                </div>
                                <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-zinc-400">
                                    <RotateCcw size={14} className="text-[#df8448]" /> 30-Day Health Trial
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
                                            className="flex w-full items-center justify-between py-5 text-left text-sm font-black uppercase tracking-wide text-[#3e4c57]"
                                        >
                                            {section.label}
                                            {isOpen ? <Minus size={18} className="text-[#df8448]" /> : <Plus size={18} className="text-zinc-300" />}
                                        </button>

                                        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[1000px] opacity-100 pb-6' : 'max-h-0 opacity-0'}`}>
                                            {section.id === 'description' && (
                                                <div
                                                    className="prose prose-zinc max-w-none text-[15px] leading-[1.8] text-zinc-500 prose-headings:text-[#3e4c57] prose-p:my-0 prose-p:leading-[1.8]"
                                                    dangerouslySetInnerHTML={{ __html: descriptionMarkup }}
                                                />
                                            )}
                                            {section.id === 'specs' && (
                                                <div className="grid grid-cols-1 gap-4">
                                                    {(product.specs && product.specs.length > 0) ? (
                                                        product.specs.map((spec, i) => (
                                                            <div key={i} className="flex justify-between border-b border-zinc-50 py-3 text-sm">
                                                                <span className="font-bold uppercase tracking-wide text-[#3e4c57]">{spec.label}</span>
                                                                <span className="text-zinc-500">{spec.value}</span>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <p className="text-zinc-400">No technical specifications available for this product yet.</p>
                                                    )}
                                                </div>
                                            )}
                                            {section.id === 'shipping' && (
                                                <ul className="space-y-4 text-[15px] leading-[1.8] text-zinc-500">
                                                    <li className="flex items-start gap-3">
                                                        <div className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#df8448]" />
                                                        <span>Free standard shipping for all US orders over $50.</span>
                                                    </li>
                                                    <li className="flex items-start gap-3">
                                                        <div className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#df8448]" />
                                                        <span>Express 2-day delivery available at checkout.</span>
                                                    </li>
                                                </ul>
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
