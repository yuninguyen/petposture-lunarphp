'use client';

import Image from 'next/image';
import { useState } from 'react';

type GalleryImage = { id: number | null; src: string; alt?: string };

// Same look as the product gallery (thumbnails beside one large image), without any cart
// behaviour. The large image is shorter on phones so the button below it stays on screen.
export function PickGallery({ images, name }: { images: GalleryImage[]; name: string }) {
    const [active, setActive] = useState(0);
    const current = images[active] ?? images[0];

    if (!current) return null;

    return (
        <div className="flex flex-col gap-3 md:flex-row">
            {images.length > 1 && (
                <div className="order-2 flex gap-3 overflow-x-auto md:order-1 md:flex-col md:overflow-visible">
                    {images.map((image, index) => (
                        <button
                            key={image.id ?? index}
                            type="button"
                            onClick={() => setActive(index)}
                            aria-label={`Show image ${index + 1}`}
                            className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-[3px] border-2 bg-white transition-colors ${
                                index === active ? 'border-secondary' : 'border-zinc-100 hover:border-zinc-300'
                            }`}
                        >
                            <Image src={image.src} alt={image.alt || name} fill sizes="64px" className="object-cover" />
                        </button>
                    ))}
                </div>
            )}

            <div className="relative order-1 aspect-[4/3] w-full max-w-[480px] overflow-hidden rounded-2xl border border-zinc-100 bg-white sm:aspect-square md:order-2">
                <Image
                    src={current.src}
                    alt={current.alt || name}
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 480px"
                    className="object-contain p-6 sm:p-8"
                />
            </div>
        </div>
    );
}
