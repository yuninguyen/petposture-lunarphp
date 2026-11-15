import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import type { Product, ProductPick } from '@/types/shop';
import { buttonClasses } from '@/components/ui/Button';
import { humanizeSlug, pickCtaLabel, pickPriceLine } from '@/lib/pick';
import { sanitizeRichHtml } from '@/lib/sanitize-rich-html';
import { PickGallery } from './PickGallery';

export const PICK_DISCLOSURE = 'PetPosture may earn a commission if you buy through this link, at no extra cost to you.';

type PickProduct = Product & { pick: ProductPick };

// The detail page of a "PetPosture Pick". PetPosture does not sell it, so there is no cart,
// stock, shipping or returns text here: one button sends the reader to the retailer.
export function PickDetails({ product, related }: { product: PickProduct; related: Product[] }) {
    const { pick } = product;
    const priceLine = pickPriceLine(pick);
    // A Pick can be published before its photo is uploaded; then there is no gallery at all.
    const photos = (product.images ?? []).filter((image) => image.src);
    const images = photos.length > 0
        ? photos
        : product.image
            ? [{ id: null, src: product.image, alt: product.name }]
            : [];

    return (
        <div className="bg-white">
            <nav aria-label="Breadcrumb" className="mx-auto flex max-w-[1200px] items-center gap-2 px-4 py-5 text-sm font-bold tracking-wide text-zinc-400 md:px-8">
                <Link href="/" className="flex shrink-0 items-center gap-1 transition-colors hover:text-rust">
                    <Home size={12} />
                    <span>Home</span>
                </Link>
                <ChevronRight size={13} className="shrink-0 text-zinc-300" />
                <span className="min-w-0 truncate text-primary">{product.name}</span>
            </nav>

            <section className="px-4 pb-16 md:px-8">
                <div className={`mx-auto grid grid-cols-1 items-start gap-6 md:gap-12 ${images.length > 0 ? 'max-w-[1200px] lg:grid-cols-2' : 'max-w-[720px]'}`}>
                    {images.length > 0 && (
                        <div className="lg:sticky lg:top-24">
                            <PickGallery images={images} name={product.name} />
                        </div>
                    )}

                    <div className="flex flex-col">
                        <p className="mb-3 text-xs font-black uppercase tracking-[0.08em] text-rust">PetPosture Pick</p>
                        <h1 className="mb-1 text-[28px] font-bold leading-[1.15] text-primary md:text-[30px]">{product.name}</h1>
                        {product.brand && (
                            <p className="mb-4 text-sm text-zinc-500">
                                By <span className="font-semibold text-primary">{product.brand}</span>
                            </p>
                        )}

                        {priceLine && <p className="mb-4 text-[15px] font-semibold text-primary">{priceLine}</p>}

                        <a
                            href={pick.goUrl}
                            target="_blank"
                            rel="sponsored nofollow noopener"
                            className={buttonClasses({ variant: 'primary', size: 'lg', className: 'w-full shadow-xl shadow-orange-500/20' })}
                        >
                            {pickCtaLabel(pick)}
                        </a>
                        <p className="mt-3 text-xs leading-5 text-zinc-500">{PICK_DISCLOSURE}</p>

                        {pick.bestForBreeds.length > 0 && (
                            <div className="mt-8">
                                <h2 className="mb-3 text-base font-black tracking-[0.05em] text-primary">Best for</h2>
                                <ul className="flex flex-wrap gap-2">
                                    {pick.bestForBreeds.map((breed) => (
                                        <li key={breed}>
                                            <Link
                                                href={`/dogs/${breed}`}
                                                className="inline-block rounded-[3px] border border-zinc-200 px-4 py-1.5 text-xs font-bold text-primary transition-colors hover:border-secondary hover:text-rust"
                                            >
                                                {humanizeSlug(breed)}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {(pick.pros.length > 0 || pick.cons.length > 0) && (
                            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
                                {pick.pros.length > 0 && (
                                    <div>
                                        <h2 className="mb-3 text-base font-black tracking-[0.05em] text-primary">Pros</h2>
                                        <ul className="space-y-2 text-sm leading-6 text-zinc-600">
                                            {pick.pros.map((item) => (
                                                <li key={item} className="flex gap-2">
                                                    <span className="font-bold text-emerald-500">+</span>
                                                    <span>{item}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {pick.cons.length > 0 && (
                                    <div>
                                        <h2 className="mb-3 text-base font-black tracking-[0.05em] text-primary">Cons</h2>
                                        <ul className="space-y-2 text-sm leading-6 text-zinc-600">
                                            {pick.cons.map((item) => (
                                                <li key={item} className="flex gap-2">
                                                    <span className="font-bold text-rose-400">–</span>
                                                    <span>{item}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}

                        {product.description && (
                            <div
                                className="mt-8 text-sm leading-7 text-zinc-600 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5"
                                dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(product.description) }}
                            />
                        )}

                        {product.specs && product.specs.length > 0 && (
                            <dl className="mt-8 divide-y divide-zinc-100 border-y border-zinc-100 text-sm">
                                {product.specs.map((spec) => (
                                    <div key={spec.label} className="flex justify-between gap-4 py-3">
                                        <dt className="font-semibold text-primary">{spec.label}</dt>
                                        <dd className="text-right text-zinc-600">{spec.value}</dd>
                                    </div>
                                ))}
                            </dl>
                        )}
                    </div>
                </div>
            </section>

            {related.length > 0 && (
                <section className="border-t border-zinc-100 bg-zinc-50 px-4 py-12 md:px-8">
                    <div className="mx-auto max-w-[1200px]">
                        <h2 className="mb-6 text-[22px] font-bold text-primary">More Picks</h2>
                        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                            {related.map((item) => (
                                <li key={item.slug}>
                                    <Link
                                        href={`/picks/${item.slug}`}
                                        className="block overflow-hidden rounded-2xl border border-zinc-100 bg-white transition-colors hover:border-secondary"
                                    >
                                        <div className="relative aspect-[4/3] bg-white">
                                            <Image src={item.image} alt={item.name} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-contain p-4" />
                                        </div>
                                        <p className="px-4 py-3 text-sm font-semibold text-primary">{item.name}</p>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>
            )}
        </div>
    );
}
