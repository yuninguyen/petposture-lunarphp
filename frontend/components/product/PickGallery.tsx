'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

type GalleryImage = { id: number | null; src: string; alt?: string };

const ARROW =
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-primary transition-colors hover:border-secondary hover:text-rust md:h-10 md:w-10';

function Chevron({ direction }: { direction: 'left' | 'right' }) {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={direction === 'left' ? 'M10 3 5 8l5 5' : 'm6 3 5 5-5 5'} />
        </svg>
    );
}

// One large image with a slider of small ones underneath: arrows at both ends step through the images
// (wrapping around), a click on a small image jumps to it. No cart behaviour. The large image is
// shorter on phones so the button below it stays on screen.
export function PickGallery({ images, name }: { images: GalleryImage[]; name: string }) {
    const [active, setActive] = useState(0);
    const thumbs = useRef<(HTMLButtonElement | null)[]>([]);
    const changed = useRef(false);
    const current = images[active] ?? images[0];
    const total = images.length;

    // Keep the chosen thumbnail inside the strip. Skipped on first paint so opening the page never scrolls it.
    useEffect(() => {
        if (!changed.current) return;
        thumbs.current[active]?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
    }, [active]);

    if (!current) return null;

    const select = (index: number) => {
        changed.current = true;
        setActive((index + total) % total);
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-zinc-100 bg-white sm:aspect-square lg:aspect-[4/3]">
                <Image
                    src={current.src}
                    alt={current.alt || name}
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 600px"
                    className="object-contain p-6 sm:p-8"
                />
                {total > 1 && (
                    <span
                        aria-live="polite"
                        className="absolute bottom-3 right-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-primary shadow-sm"
                    >
                        {active + 1}/{total}
                    </span>
                )}
            </div>

            {total > 1 && (
                <div className="flex items-center gap-2">
                    <button type="button" onClick={() => select(active - 1)} aria-label="Previous image" className={ARROW}>
                        <Chevron direction="left" />
                    </button>
                    <div className="flex min-w-0 flex-1 gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {images.map((image, index) => (
                            <button
                                key={image.id ?? index}
                                ref={(node) => {
                                    thumbs.current[index] = node;
                                }}
                                type="button"
                                onClick={() => select(index)}
                                aria-label={`Show image ${index + 1}`}
                                aria-current={index === active ? 'true' : undefined}
                                className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-[3px] border-2 bg-white transition-colors md:h-[72px] md:w-[72px] ${
                                    index === active ? 'border-secondary' : 'border-zinc-100 hover:border-zinc-300'
                                }`}
                            >
                                <Image src={image.src} alt={image.alt || name} fill sizes="72px" className="object-cover" />
                            </button>
                        ))}
                    </div>
                    <button type="button" onClick={() => select(active + 1)} aria-label="Next image" className={ARROW}>
                        <Chevron direction="right" />
                    </button>
                </div>
            )}
        </div>
    );
}
