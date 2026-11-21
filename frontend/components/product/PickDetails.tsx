import Link from 'next/link';
import type { Product, ProductPick } from '@/types/shop';
import { formatPickDate, humanizeSlug } from '@/lib/pick';
import { sanitizeRichHtml } from '@/lib/sanitize-rich-html';
import { stripHtml } from '@/lib/text';
import { PickAccordionSection } from './PickAccordionSection';
import { PickCard } from './PickCard';
import { PickGallery } from './PickGallery';
import { PickBuyBox, PickSpecs, PickVariantProvider } from './PickVariantSelector';

export { PICK_DISCLOSURE } from '@/lib/pick';

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
// The top is a short hero: the photo on the left, the title and the buy box on the right, each as tall as its
// own content. Everything else runs full width underneath, so neither column can end up empty:
// our take, best for, product details (the quick specs), the practical difference, pros and cons.
// On a phone the order is: title, photo, buy box, then the rest as written.
// Every editorial block is left out when it was not entered.
export function PickDetails({ product, related }: { product: PickProduct; related: Product[] }) {
    const { pick } = product;

    // A Pick can be published before its photo is uploaded; then there is no gallery at all.
    const photos = (product.images ?? []).filter((image) => image.src);
    const images = photos.length > 0
        ? photos
        : product.image
            ? [{ id: null, src: product.image, alt: product.name }]
            : [];
    const hasPhoto = images.length > 0;
    const rightColumn = hasPhoto ? 'lg:col-start-2' : '';
    const width = hasPhoto ? 'max-w-[1200px]' : 'max-w-[720px]';

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
    // An empty rich-text field is saved as "<p></p>"; that has no text, and drawing it would leave a gap.
    const hasDescription = stripHtml(product.description ?? '') !== '';
    const sideBySide = hasDescription && specs.length > 0;

    return (
        <div className="bg-white">
            <nav aria-label="Breadcrumb" className="border-b border-[#e2e5e8] bg-[#f4f5f6]">
                <ol className="mx-auto flex max-w-[1200px] items-center gap-2 px-4 py-[11px] text-[13px] text-[#6b7680] md:px-8">
                    <li className="shrink-0">
                        <Link href="/" className="text-[#6b7680] hover:underline">Home</Link>
                    </li>
                    <li aria-hidden="true" className="shrink-0">›</li>
                    <li className="shrink-0">
                        <Link href="/picks" className="font-bold text-[#3e4c57] hover:underline">Picks</Link>
                    </li>
                    <li aria-hidden="true" className="shrink-0">›</li>
                    <li aria-current="page" className="min-w-0 truncate">{product.name}</li>
                </ol>
            </nav>

            <section className="px-4 pb-12 pt-6 md:px-8">
                <PickVariantProvider variants={pick.variants}>
                <div className={`mx-auto grid grid-cols-1 items-start gap-x-12 gap-y-6 ${hasPhoto ? `${width} lg:grid-cols-2 lg:grid-rows-[auto_1fr]` : width}`}>
                    {/* On a phone the blocks stack in this order: title, photo, then the buy box. `order` only moves
                        what is drawn; from lg up the explicit columns below place everything and `order` is reset. */}
                    <header className={`order-[-2] lg:order-none ${rightColumn}`}>
                        <p className="mb-3 inline-block rounded-[3px] bg-secondary-light px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-rust">{eyebrow}</p>
                        <h1 className="mb-1 text-[28px] font-bold leading-[1.15] text-primary md:text-[34px]">{product.name}</h1>
                        {product.brand && (
                            <p className="text-sm text-zinc-500">
                                By <span className="font-semibold text-primary">{product.brand}</span>
                            </p>
                        )}
                    </header>

                    <div className={`${cardClass} shadow-[0_12px_32px_rgba(34,33,33,0.08)] ${rightColumn}`}>
                        <PickBuyBox pick={pick} today={new Date().toISOString().slice(0, 10)} />
                    </div>

                    {hasPhoto && (
                        <div className="order-[-1] lg:order-none lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:self-start">
                            <PickGallery images={images} name={product.name} />
                        </div>
                    )}
                </div>

                <div className={`mx-auto mt-10 flex flex-col gap-10 ${width}`}>
                    {pick.ourTake && (
                        <div className="rounded-2xl bg-secondary-light p-5">
                            <h3 className="mb-2 text-base font-black text-primary">Our take</h3>
                            <p className="whitespace-pre-line text-sm leading-7 text-[#3E4C57]">{pick.ourTake}</p>
                        </div>
                    )}

                    {hasBestFor && (
                        <div>
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
                                    <li key={note} className="inline-block rounded-[3px] border border-zinc-200 px-4 py-1.5 text-xs font-bold text-primary">
                                        {note}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* One box holding Product details (the description) and Quick Specs: two columns from lg up when both
                        are there, one above the other below that. Alone, a column takes the whole box. With neither, the box
                        has no children and `empty:hidden` takes it out of the layout, so no gap is left. */}
                    <div className={`${cardClass} grid grid-cols-1 items-start empty:hidden lg:gap-6 ${sideBySide ? 'lg:grid-cols-2 lg:gap-x-10' : ''}`}>
                        {hasDescription && (
                            <PickAccordionSection title="Product details">
                                <div
                                    className="text-sm leading-7 text-zinc-600 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5"
                                    dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(product.description ?? '') }}
                                />
                            </PickAccordionSection>
                        )}
                        <PickSpecs specs={specs} className="" title="Quick Specs" wide={!hasDescription} accordion />
                    </div>

                    {hasPractical && (
                        <div>
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
                    )}

                    {hasProsCons && (
                        <div>
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
                    )}
                </div>
                </PickVariantProvider>
            </section>

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
                            {/* Only the fallback of the section: next to related cards it would sit alone on a second row. */}
                            {related.length === 0 && firstBreed && (
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
                        {related.length > 0 && (
                            <p className="mt-8 text-center">
                                <Link
                                    href={firstBreed ? `/picks?breed=${firstBreed}` : '/picks'}
                                    className="inline-flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-[0.08em] text-rust hover:underline"
                                >
                                    {`See all ${firstBreed ? `${humanizeSlug(firstBreed)} ` : ''}Picks`}{' '}
                                    <span aria-hidden="true">→</span>
                                </Link>
                            </p>
                        )}
                    </div>
                </section>
            )}
        </div>
    );
}
