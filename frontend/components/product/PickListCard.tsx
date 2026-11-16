import Image from 'next/image';
import Link from 'next/link';
import { humanizeSlug, pickCardPrice, pickRetailerName, pickTakeSummary, type PickProduct } from '@/lib/pick';

// A Pick on the /picks list. It only ever links to the Pick's own page; the retailer is opened from there, by the
// one tracked button. The price is the retailer's, with the date it was checked, and goes away once that is stale.
// There is no sale badge or struck-through price: the API has no compare price for a Pick.
export function PickListCard({ product, allBreedsCount, now }: { product: PickProduct; allBreedsCount: number; now: Date }) {
    const { pick } = product;
    const take = pickTakeSummary(pick.ourTake);
    const bestFor = pick.bestForNotes[0] ?? null;
    const price = pickCardPrice(pick, now);
    const retailer = pickRetailerName(pick);
    const suitsEveryBreed = pick.bestForBreeds.length > 2 && pick.bestForBreeds.length === allBreedsCount;
    const breedChips = suitsEveryBreed ? [`All ${allBreedsCount} breeds`] : pick.bestForBreeds.map(humanizeSlug);
    // The first solution tag labels the card; a Pick that is not tagged has no label.
    const solution = product.solutionTags?.[0] ? humanizeSlug(product.solutionTags[0]) : null;

    return (
        <article className="group flex flex-col overflow-hidden rounded-2xl border border-[#e2e5e8] bg-white shadow-[0_3px_14px_rgba(44,56,64,0.05)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(44,56,64,0.1)]">
            <Link href={`/picks/${product.slug}`} className="flex h-full flex-col">
                {product.image && (
                    <div className="relative aspect-[4/3.1] overflow-hidden bg-[#f7f3ec]">
                        <Image
                            src={product.image}
                            alt={product.name}
                            fill
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            className="object-contain p-3 mix-blend-multiply"
                        />
                        {solution && (
                            <span className="absolute left-3 top-3 rounded-full bg-white px-[11px] py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[#8f4a1f] shadow-[0_3px_10px_rgba(44,56,64,0.14)]">
                                {solution}
                            </span>
                        )}
                    </div>
                )}

                <div className="flex flex-1 flex-col px-[19px] pb-[19px] pt-[17px]">
                    {product.brand && (
                        <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#6b7680]">{product.brand}</p>
                    )}
                    <h3 className="mb-[7px] mt-[5px] text-[17.5px] font-semibold leading-[1.3] text-[#2c3840]">{product.name}</h3>

                    {take && <p className="line-clamp-4 text-[14px] leading-[1.55] text-[#4b5563]">{take}</p>}

                    {bestFor && (
                        <p className="mt-[11px] text-[13px] text-[#2c3840]">
                            <b>Best for:</b> {bestFor}
                        </p>
                    )}

                    {breedChips.length > 0 && (
                        <div className="mt-[11px] flex flex-wrap gap-1.5">
                            {breedChips.map((chip) => (
                                <span key={chip} className="rounded-full border border-[#e2e5e8] bg-[#f4f5f6] px-2.5 py-1 text-[11.5px] font-bold text-[#3e4c57]">
                                    {chip}
                                </span>
                            ))}
                        </div>
                    )}

                    <div className="mt-auto pt-[15px]">
                        {price && (
                            <div className="border-t border-dashed border-[#e2e5e8] pt-[13px]">
                                <p className="flex items-baseline gap-[9px]">
                                    <span className="text-[21px] font-extrabold text-[#2c3840]">{price.amount}</span>
                                    {retailer && <span className="text-xs font-bold text-[#6b7680]">at {retailer}</span>}
                                </p>
                                <p className="mt-0.5 text-xs text-[#6b7680]">{price.note}</p>
                            </div>
                        )}
                        <span className="mt-[11px] inline-flex items-center gap-[7px] text-[13px] font-bold uppercase tracking-[0.05em] text-[#c9713a]">
                            View pick <span aria-hidden="true">→</span>
                        </span>
                    </div>
                </div>
            </Link>
        </article>
    );
}
