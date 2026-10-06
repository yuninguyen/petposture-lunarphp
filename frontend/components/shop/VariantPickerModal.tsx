"use client";

import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '../ui/Button';
import type { Product } from '../../types/shop';
import { choiceState, selectionOf, variantFor, type VariantSelection } from '../../lib/variantSelection';

type VariantPickerModalProps = {
    product: Product;
    open: boolean;
    onClose: () => void;
    // Receives the product with the chosen variant filled in, ready for the cart.
    onAdd: (item: Product) => void;
};

const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function VariantPickerModal({ product, open, onClose, onAdd }: VariantPickerModalProps) {
    if (!open) return null;
    // Rendered in <body>: a product card is transformed on hover, which would otherwise become the containing
    // block of this fixed overlay.
    return createPortal(<PickerDialog product={product} onClose={onClose} onAdd={onAdd} />, document.body);
}

// Mounted only while open, so every opening starts from a fresh selection.
function PickerDialog({ product, onClose, onAdd }: Omit<VariantPickerModalProps, 'open'>) {
    const titleId = useId();
    const dialogRef = useRef<HTMLDivElement>(null);
    const options = product.options ?? [];
    const variants = product.variants ?? [];

    const [selection, setSelection] = useState<VariantSelection>(() =>
        selectionOf(variants.find((v) => v.id === product.variantId && v.available) ?? variants.find((v) => v.available) ?? variants[0]),
    );
    const selected = variantFor(variants, selection);
    const canAdd = Boolean(selected?.available);

    // Focus goes into the dialog and comes back to the button that opened it; the page behind does not scroll.
    useEffect(() => {
        const opener = document.activeElement as HTMLElement | null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        dialogRef.current?.focus();
        return () => {
            document.body.style.overflow = previousOverflow;
            opener?.focus?.();
        };
    }, []);

    function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
        if (event.key === 'Escape') {
            event.stopPropagation();
            onClose();
            return;
        }
        if (event.key !== 'Tab') return;

        // Keep Tab / Shift+Tab inside the dialog.
        const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? []);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    function handleAdd() {
        if (!selected || !selected.available) return;
        onAdd({
            ...product,
            variantId: selected.id,
            price: selected.price,
            oldPrice: selected.comparePrice ?? product.oldPrice,
            image: selected.image || product.image,
        });
    }

    const price = selected?.price ?? product.price;
    const oldPrice = selected?.comparePrice ?? product.oldPrice;

    return (
        <div
            className="fixed inset-0 z-[110] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                onKeyDown={handleKeyDown}
                className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl outline-none sm:rounded-2xl"
            >
                <div className="flex items-start justify-between gap-4">
                    <h2 id={titleId} className="text-sm font-bold uppercase tracking-[0.08em] text-zinc-500">
                        Choose options
                    </h2>
                    <Button type="button" variant="quiet" size="icon" onClick={onClose} aria-label="Close" className="-mr-2 -mt-2">
                        <X size={18} aria-hidden="true" />
                    </Button>
                </div>

                <div className="mt-4 flex items-center gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={selected?.image || product.image}
                        alt=""
                        className="h-20 w-20 flex-shrink-0 rounded-[10px] border border-zinc-100 bg-white object-contain p-1"
                    />
                    <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-semibold text-primary">{product.name}</p>
                        <p className="mt-1 flex items-baseline gap-2">
                            <span className="text-lg font-bold text-primary">${price.toFixed(2)}</span>
                            {oldPrice ? <span className="text-sm text-zinc-300 line-through">${oldPrice.toFixed(2)}</span> : null}
                        </p>
                    </div>
                </div>

                <div className="mt-5 space-y-5">
                    {options.map((option) => (
                        <div key={option.id}>
                            <p className="mb-2 text-sm font-black capitalize tracking-[0.05em] text-primary">{option.name}</p>
                            <div className="flex flex-wrap gap-2">
                                {option.values.map((value) => {
                                    const state = choiceState(variants, selection, option.name, value.id);
                                    const isSelected = selection[option.name] === value.id;
                                    return (
                                        <button
                                            key={value.id}
                                            type="button"
                                            disabled={state === 'not_offered'}
                                            aria-pressed={isSelected}
                                            onClick={() => setSelection((prev) => ({ ...prev, [option.name]: value.id }))}
                                            className={`rounded-[3px] border-2 px-4 py-2 text-sm font-bold capitalize transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                                                isSelected
                                                    ? 'border-secondary bg-secondary text-ink'
                                                    : 'border-zinc-200 bg-white text-primary hover:border-secondary'
                                            } ${state === 'sold_out' ? 'text-zinc-400 line-through' : ''}`}
                                        >
                                            {value.name}
                                            {state === 'sold_out' ? <span className="sr-only"> (sold out)</span> : null}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                <p className={`mt-5 text-xs font-bold ${canAdd ? 'text-green-600' : 'text-zinc-400'}`}>{canAdd ? 'In Stock' : 'Out of Stock'}</p>

                <Button type="button" variant="primary" onClick={handleAdd} disabled={!canAdd} className="mt-4 w-full">
                    {canAdd ? 'Add to Cart' : 'Out of stock'}
                </Button>
            </div>
        </div>
    );
}
