'use client';

import { useId, useState, type ReactNode } from 'react';

const titleClass = 'text-[11px] font-black uppercase tracking-[0.12em] text-zinc-500';

// A block of a Pick page that is an accordion on a phone and a plain titled block from lg up.
//
// Below lg the title is a button with a plus or a minus: pressing it shows or hides the content, which starts hidden.
// From lg up the button is not drawn, the title is the plain title it always was and the content is always shown.
// The split is made by the breakpoint classes alone, so what the server draws and what the browser draws agree.
export function PickAccordionSection({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
    const [open, setOpen] = useState(false);
    const contentId = useId();

    return (
        <div className={`border-t border-zinc-100 first:border-t-0 lg:border-t-0 ${className}`}>
            <h3 className={`mb-3 hidden lg:block ${titleClass}`}>{title}</h3>
            <h3 className="lg:hidden">
                <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={contentId}
                    onClick={() => setOpen((current) => !current)}
                    className="flex min-h-[44px] w-full items-center justify-between gap-4 text-left"
                >
                    <span className={titleClass}>{title}</span>
                    <span aria-hidden="true" className="text-xl font-normal leading-none text-zinc-500">{open ? '−' : '+'}</span>
                </button>
            </h3>
            <div id={contentId} className={`${open ? 'block pb-3' : 'hidden'} lg:block lg:pb-0`}>
                {children}
            </div>
        </div>
    );
}
