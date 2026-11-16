import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import type { Product, ProductPick } from '@/types/shop';
import { buttonClasses } from '@/components/ui/Button';
import { formatPickDate, humanizeSlug, pickCtaLabel, pickPriceParts } from '@/lib/pick';
import { sanitizeRichHtml } from '@/lib/sanitize-rich-html';
import { PickCard } from './PickCard';
import { PickGallery } from './PickGallery';

export const PICK_DISCLOSURE = 'PetPosture may earn a commission if you buy through this link, at no extra cost to you.';

type PickProduct = Product & { pick: ProductPick };

const cardClass = 'rounded-2xl border border-zinc-200 bg-white p-5';

function SectionTitle({ children }: { children: string }) {
    return (
        <div className="mb-8 text-center">
            <h2 className="text-[24px] font-bold text-primary md:text-[28px]">{children}</h2>
            <div className="mx-auto mt-3 h-[3px] w-11 rounded-full bg-secondary" />
        </div>
    );
}

// The detail page of a "PetPosture Pick". PetPosture does not sell it, so there is no cart, stock, shipping
// or returns text here: one button sends the reader to the retailer.
//
// The blocks are in reading order for a phone: title, buy box, our take, photo, specs, best for. On a wide
// screen the photo moves to the left column. Every editorial block is left out when it was not entered.
export function PickDetails({ product, related }: { product: PickProduct; related: Product[] }) {
    const { pick } = product;
    const price = pickPriceParts(pick);

    // A Pick can be published before its photo is uploaded; then there is no gallery at all.
    const photos = (product.images ?? []).filter((image) => image.src);
    const images = photos.length > 0
        ? photos
        : product.image
            ? [{ id: null, src: product.image, alt: product.name }]
            : [];
    const hasPhoto = images.length > 0;
    const rightColumn = hasPhoto ? 'lg:col-start-2' : '';

    // Quick specs win over a product spec with the same label, so a fact is never listed twice.
    const quickLabels = new Set(pick.quickSpecs.map((spec) => spec.label.toLowerCase()));
    const specs = [
        ...pick.quickSpecs,
        ...(product.specs ?? []).filter((spec) => !quickLabels.has(spec.label.toLowerCase())),
    ];

    const eyebrow = pick.priceCheckedDate
        ? `PetPosture Pick · Checked ${formatPickDate(pick.priceCheckedDate)}`
        : 'PetPosture Pick';
    const firstBreed = pick.bestForBreeds[0];
    const hasBestFor = pick.bestForBreeds.length > 0 || pick.bestForNotes.length > 0;
    const hasPractical = Boolean(pick.problem || pick.approach);
    const hasProsCons = pick.pros.length > 0 || pick.cons.length > 0;

    return (
        <div className="bg-white">
            <nav aria-label="Breadcrumb" className="mx-auto flex max-w-[1200px] items-center gap-2 px-4 py-5 text-sm font-bold tracking-wide text-zinc-400 md:px-8">
                <Link href="/" className="flex shrink-0 items-center gap-1 transition-colors hover:text-rust">
                    <Home size={12} />
                    <span>Home</span>
                </Link>
                <ChevronRight size={13} className="shrink-0 text-zinc-300" />
                <Link href="/picks" className="shrink-0 transition-colors hover:text-rust">Picks</Link>
                <ChevronRight size={13} className="shrink-0 text-zinc-300" />
                <span className="min-w-0 truncate text-primary">{product.name}</span>
            </nav>

            <section className="px-4 pb-12 md:px-8">
                <div className={`mx-auto grid grid-cols-1 items-start gap-x-12 gap-y-6 ${hasPhoto ? 'max-w-[1200px] lg:grid-cols-2' : 'max-w-[720px]'}`}>
                    <header className={rightColumn}>
                        <p className="mb-3 inline-block rounded-[3px] bg-secondary-light px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-rust">{eyebrow}</p>
                        <h1 className="mb-1 text-[28px] font-bold leading-[1.15] text-primary md:text-[34px]">{product.name}</h1>
                        {product.brand && (
                            <p className="text-sm text-zinc-500">
                                By <span className="font-semibold text-primary">{product.brand}</span>
                            </p>
                        )}
                    </header>

                    <div className={`${cardClass} shadow-[0_12px_32px_rgba(34,33,33,0.08)] ${rightColumn}`}>
                        {price && (
                            <div className="mb-4">
                                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-zinc-500">{price.label}</p>
                                <p className="py-[10px] text-[32px] font-bold leading-tight text-primary">{price.amount}</p>
                                <p className="text-xs text-zinc-500">{price.note}</p>
                            </div>
                        )}
                        <a
                            href={pick.goUrl}
                            target="_blank"
                            rel="sponsored nofollow noopener"
                            className={buttonClasses({ variant: 'primary', size: 'lg', className: 'w-full gap-2 shadow-xl shadow-orange-500/20' })}
                        >
                            {pickCtaLabel(pick)}<span aria-hidden="true">→</span>
                        </a>
                        <p className="mt-3 text-xs leading-5 text-zinc-500">{PICK_DISCLOSURE}</p>
                        <p className="mt-2 text-xs leading-5 text-zinc-500">No made-up star ratings: just pros and cons.</p>
                    </div>

                    {pick.ourTake && (
                        <div className={`rounded-2xl bg-secondary-light p-5 ${rightColumn}`}>
                            <h3 className="mb-2 text-base font-black text-primary">Our take</h3>
                            <p className="whitespace-pre-line text-sm leading-7 text-[#3E4C57]">{pick.ourTake}</p>
                        </div>
                    )}

                    {hasPhoto && (
                        <div className="lg:col-start-1 lg:row-span-6 lg:row-start-1 lg:self-start">
                            <PickGallery images={images} name={product.name} />
                        </div>
                    )}

                    {specs.length > 0 && (
                        <div className={`${cardClass} ${rightColumn}`}>
                            <h3 className="mb-3 text-[11px] font-black uppercase tracking-[0.12em] text-zinc-500">Quick specs</h3>
                            <dl className="divide-y divide-zinc-100 text-sm">
                                {specs.map((spec) => (
                                    <div key={spec.label} className="flex justify-between gap-4 py-2.5">
                                        <dt className="font-semibold text-primary">{spec.label}</dt>
                                        <dd className="text-right text-zinc-600">{spec.value}</dd>
                                    </div>
                                ))}
                            </dl>
                        </div>
                    )}

                    {hasBestFor && (
                        <div className={rightColumn}>
                            <h3 className="mb-3 text-[11px] font-black uppercase tracking-[0.12em] text-zinc-500">Best for</h3>
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
                                {pick.bestForNotes.map((note) => (
                                    <li key={note} className="inline-block rounded-[3px] bg-zinc-50 px-4 py-1.5 text-xs font-semibold text-zinc-600">
                                        {note}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {product.description && (
                        <div
                            className={`text-sm leading-7 text-zinc-600 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 ${rightColumn}`}
                            dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(product.description) }}
                        />
                    )}
                </div>
            </section>

            {hasPractical && (
                <section className="bg-zinc-50 px-4 py-12 md:px-8">
                    <div className="mx-auto max-w-[1000px]">
                        <SectionTitle>The practical difference</SectionTitle>
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            {pick.problem && (
                                <div className={cardClass}>
                                    <h3 className="mb-2 text-base font-black text-primary">The Problem</h3>
                                    <p className="text-sm leading-7 text-zinc-600">{pick.problem}</p>
                                </div>
                            )}
                            {pick.approach && (
                                <div className={cardClass}>
                                    <h3 className="mb-2 text-base font-black text-primary">The PetPosture Approach</h3>
                                    <p className="text-sm leading-7 text-zinc-600">{pick.approach}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            )}

            {hasProsCons && (
                <section className="px-4 py-12 md:px-8">
                    <div className="mx-auto max-w-[1000px]">
                        <SectionTitle>Honest Pros & Cons</SectionTitle>
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            {pick.pros.length > 0 && (
                                <div className={cardClass}>
                                    <h3 className="mb-3 text-base font-black text-primary">What we like</h3>
                                    <ul className="space-y-2 text-sm leading-6 text-zinc-600">
                                        {pick.pros.map((item) => (
                                            <li key={item} className="flex gap-2">
                                                <span className="font-bold text-emerald-500">✓</span>
                                                <span>{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {pick.cons.length > 0 && (
                                <div className={cardClass}>
                                    <h3 className="mb-3 text-base font-black text-primary">What to know first</h3>
                                    <ul className="space-y-2 text-sm leading-6 text-zinc-600">
                                        {pick.cons.map((item) => (
                                            <li key={item} className="flex gap-2">
                                                <span className="font-bold text-rose-500">✕</span>
                                                <span>{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            )}

            {(related.length > 0 || firstBreed) && (
                <section className="border-t border-zinc-100 bg-zinc-50 px-4 py-12 md:px-8">
                    <div className="mx-auto max-w-[1200px]">
                        <SectionTitle>More PetPosture Picks</SectionTitle>
                        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {related.map((item) => (
                                <li key={item.slug}>
                                    <PickCard product={item} />
                                </li>
                            ))}
                            {firstBreed && (
                                <li>
                                    <Link
                                        href={`/picks?breed=${firstBreed}`}
                                        className="flex h-full min-h-[160px] flex-col justify-center rounded-[15px] border border-[#e8e1d8] bg-white p-6 transition duration-300 hover:-translate-y-1 hover:border-secondary"
                                    >
                                        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#56616a]">{humanizeSlug(firstBreed)}</span>
                                        <span className="mt-1 text-[17px] font-semibold text-[#2d3a43]">All {humanizeSlug(firstBreed)} Picks</span>
                                        <span className="mt-3 text-xs font-bold uppercase tracking-[0.08em] text-rust">
                                            Explore all <span aria-hidden="true">→</span>
                                        </span>
                                    </Link>
                                </li>
                            )}
                        </ul>
                    </div>
                </section>
            )}
        </div>
    );
}
