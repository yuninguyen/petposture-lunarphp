import Image from 'next/image';
import Link from 'next/link';
import { formatPickDate, humanizeSlug, pickCardPrice, pickProducts, pickRetailerName } from '@/lib/pick';
import type { Product } from '@/types/shop';

// "Products mentioned in this guide": the Picks an article links, at the end of the article above the comments. A compact
// version of the /picks card (photo, solution tag, brand, name, the retailer price with the date it was checked) that
// opens the Pick's own page. Left out entirely when the article links no Pick.
export function MentionedPicks({ picks, postTitle, now }: { picks: Product[]; postTitle: string; now: string }) {
    const items = pickProducts(picks);
    if (items.length === 0) return null;

    const today = new Date(now);

    return (
        <section aria-labelledby="mentioned-picks-title" className="mt-16">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#3e4c57]">{postTitle}</p>
            <h2 id="mentioned-picks-title" className="mt-1 text-[22px] font-extrabold text-[#2c3840]">
                Products mentioned in this guide
            </h2>
            <p className="mt-1 text-[14px] leading-6 text-[#4b5563]">
                Prices are the retailer prices we checked, with the date next to them.
            </p>

            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {items.map((product) => {
                    const price = pickCardPrice(product.pick, today);
                    const retailer = pickRetailerName(product.pick);
                    const solution = product.solutionTags?.[0] ? humanizeSlug(product.solutionTags[0]) : null;

                    return (
                        <li key={product.slug} className="flex flex-col rounded-xl border border-[#e4e4e7] bg-white p-3.5">
                            {product.image && (
                                <div className="relative mb-2.5 aspect-[4/3] overflow-hidden rounded-lg bg-[#fdf2ea]">
                                    <Image
                                        src={product.image}
                                        alt={product.name}
                                        fill
                                        sizes="(max-width: 640px) 100vw, 400px"
                                        className="object-contain p-2 mix-blend-multiply"
                                    />
                                </div>
                            )}
                            {solution && <span className="text-[11px] font-bold uppercase tracking-[0.04em] text-[#c9713a]">{solution}</span>}
                            {product.brand && <p className="mt-[5px] text-[14px] font-bold text-[#2c3840]">{product.brand}</p>}
                            <h3 className="mt-0.5 text-[13px] font-normal leading-[1.45] text-[#4b5563]">{product.name}</h3>
                            {price && (
                                <p className="mt-[9px] text-[14px] font-extrabold text-[#2c3840]">
                                    {price.amount}{' '}
                                    <span className="text-xs font-normal text-[#71717a]">
                                        {retailer ? `at ${retailer} · ` : ''}Checked {formatPickDate(product.pick.priceCheckedDate as string)}
                                    </span>
                                </p>
                            )}
                            <Link href={`/picks/${product.slug}`} className="mt-2.5 inline-block text-[13px] font-bold text-[#c9713a] hover:underline">
                                View pick →
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
