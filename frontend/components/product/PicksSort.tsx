'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronDown } from 'lucide-react';
import { PICK_SORTS, picksHref, type PickSort } from '@/lib/pick';

/**
 * "Sort by:" menu on the Showing row. The button opens a list of plain links, one per sort, so each choice is an
 * address of its own (breed, solution and search words kept, no page, so it starts again from page 1). The chosen
 * one has a peach background and a check mark. The "Sort by:" word is hidden on a phone; only the menu shows.
 */
export function PicksSort({ breed, solution, q, sort }: { breed: string | null; solution: string | null; q: string | null; sort: PickSort }) {
    const [open, setOpen] = useState(false);
    const root = useRef<HTMLDivElement>(null);
    const current = PICK_SORTS.find((option) => option.value === sort) ?? PICK_SORTS[0];

    useEffect(() => {
        if (!open) return;
        const close = (event: MouseEvent | KeyboardEvent) => {
            if (event instanceof KeyboardEvent ? event.key === 'Escape' : !root.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', close);

        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', close);
        };
    }, [open]);

    return (
        <div ref={root} className="relative flex items-center gap-2">
            <span className="hidden text-[13px] text-[#71717a] sm:inline">Sort by:</span>
            <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={`Sort by: ${current.label}`}
                onClick={() => setOpen((value) => !value)}
                className="flex h-9 items-center gap-[7px] rounded-[10px] border border-[#e4e4e7] bg-white px-[11px] text-[13px] font-bold text-[#2c3840]"
            >
                {current.label}
                <ChevronDown size={14} className="text-[#71717a]" aria-hidden="true" />
            </button>
            {open && (
                <ul role="listbox" aria-label="Sort picks" className="absolute right-0 top-full z-20 mt-1.5 min-w-[200px] overflow-hidden rounded-xl border border-[#e4e4e7] bg-white py-1 shadow-[0_8px_24px_rgba(44,56,64,0.12)]">
                    {PICK_SORTS.map((option) => {
                        const chosen = option.value === sort;

                        return (
                            <li key={option.value} role="option" aria-selected={chosen}>
                                <Link
                                    href={picksHref({ breed, solution, q, sort: option.value })}
                                    className={`flex items-center justify-between gap-3 px-3.5 py-2 text-[13px] ${chosen ? 'bg-[#fdf2ea] font-bold text-[#2c3840]' : 'text-[#3e4c57] hover:bg-[#f4f4f5]'}`}
                                >
                                    {option.label}
                                    {chosen && <Check size={14} className="text-[#c9713a]" aria-hidden="true" />}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
