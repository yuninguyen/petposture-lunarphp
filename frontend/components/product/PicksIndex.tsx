import Link from 'next/link';
import { Check, Search, Star } from 'lucide-react';
import { filterPicksByBreed, formatPickDate, humanizeSlug, pickBreeds, pickListStats, type PickProduct } from '@/lib/pick';
import { PickListCard } from './PickListCard';

const chipClass = (active: boolean) =>
    `inline-flex min-h-[40px] shrink-0 items-center rounded-full border-[1.5px] px-4 py-2 text-[13.5px] font-semibold transition-colors ${
        active ? 'border-[#3e4c57] bg-[#3e4c57] text-white' : 'border-[#e2e5e8] bg-white text-[#3e4c57] hover:border-[#df8448]'
    }`;

const statClass =
    'inline-flex items-center gap-2 rounded-full border border-[#f3ddc9] bg-[#fdf7f0] px-[15px] py-2 text-[13px] font-semibold text-[#2c3840]';

const HOW_WE_CHOOSE = [
    {
        icon: Search,
        title: '1 · Matched to a body shape first',
        text: 'We start from the breed — chest width, back length, muzzle shape, neck strain — and only then look at products. If it doesn’t solve a shape-specific problem, it doesn’t become a Pick.',
    },
    {
        icon: Star,
        title: '2 · Checked against real reviews',
        text: 'Each pick is read against the seller’s description and customer reviews — including the critical ones. When a listing overstates something, like bowl capacity, we say so on the pick itself.',
    },
    {
        icon: Check,
        title: '3 · Priced and dated, every time',
        text: 'A price on a card is the retailer’s price we checked, with the date next to it — never presented as our own price, and dropped once that check gets old. Prices change, so the full pick page tells you to re-check before ordering.',
    },
];

// The list of PetPosture Picks, optionally narrowed to one breed. It is handed every Pick and works out the rest:
// the breed chips, the count, and what the header may claim. There is no cart, stock or sale here; the retailer
// price on a card is dated and goes away once that date is more than 30 days old.
export function PicksIndex({ allPicks, breed, now }: { allPicks: PickProduct[]; breed: string | null; now: Date }) {
    const breeds = pickBreeds(allPicks);
    const picks = filterPicksByBreed(allPicks, breed);
    const stats = pickListStats(allPicks);
    const breedName = breed ? humanizeSlug(breed) : null;

    return (
        <>
            <div className="mx-auto max-w-[1180px] px-4 py-8 md:py-10">
                <nav aria-label="Breadcrumb" className="mb-6 text-[13px] text-[#56616a]">
                    <ol className="flex flex-wrap items-center gap-2">
                        <li>
                            <Link href="/" className="hover:underline">Home</Link>
                        </li>
                        <li aria-hidden="true">›</li>
                        <li aria-current="page" className="font-semibold text-[#2d3a43]">Picks</li>
                    </ol>
                </nav>

                <header className="text-center">
                    <span className="inline-block rounded-[3px] bg-[#fdf2ea] px-[11px] py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#8f4a1f]">
                        PetPosture Picks
                    </span>
                    <h1 className="mt-3.5 text-[clamp(30px,4.4vw,44px)] font-extrabold leading-[1.15] tracking-[-0.015em] text-[#2c3840]">
                        Picked for the <em className="not-italic text-[#c9713a]">shape of your dog</em>,<br />not just the shelf it sat on.
                    </h1>
                    <p className="mx-auto mt-3.5 max-w-[640px] text-[17px] leading-7 text-[#4b5563]">
                        Products we looked at for dogs with a particular body shape — what we like, what to know first, and the price we
                        checked, all on the card. No fake ratings, no “best ever” claims.
                    </p>

                    {stats.count > 0 && (
                        <div className="mt-[22px] flex flex-wrap justify-center gap-2.5">
                            <span className={statClass}>
                                <Check size={15} strokeWidth={2.6} className="text-[#c9713a]" aria-hidden="true" />
                                {stats.count === 1 ? '1 pick' : `${stats.count} picks`}
                                {stats.latestChecked ? `, checked ${formatPickDate(stats.latestChecked)}` : ''}
                            </span>
                            {stats.everyPickHasCons && (
                                <span className={statClass}>
                                    <Check size={15} strokeWidth={2.6} className="text-[#c9713a]" aria-hidden="true" />
                                    Honest downsides on every pick
                                </span>
                            )}
                            <span className={statClass}>
                                <Check size={15} strokeWidth={2.6} className="text-[#c9713a]" aria-hidden="true" />
                                {"We haven't tested these ourselves — and we say so"}
                            </span>
                        </div>
                    )}
                </header>

                {allPicks.length > 0 && breeds.length > 0 && (
                    <section aria-label="Filter picks" className="mt-8 border-y border-[#e2e5e8] py-3.5">
                        <div className="flex items-center gap-3">
                            <span className="w-[54px] shrink-0 text-[11.5px] font-bold uppercase tracking-[0.12em] text-[#6b7680]">Breed</span>
                            <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
                                <Link href="/picks" className={chipClass(!breed)} {...(!breed ? { 'aria-current': 'true' } : {})}>All breeds</Link>
                                {breeds.map((slug) => (
                                    <Link
                                        key={slug}
                                        href={`/picks?breed=${encodeURIComponent(slug)}`}
                                        className={chipClass(slug === breed)}
                                        {...(slug === breed ? { 'aria-current': 'true' } : {})}
                                    >
                                        {humanizeSlug(slug)}
                                    </Link>
                                ))}
                            </div>
                        </div>
                        <p role="status" className="mt-2.5 text-[13.5px] text-[#6b7680]">
                            Showing <b className="font-semibold text-[#2c3840]">{`${picks.length} of ${allPicks.length}`}</b> picks
                        </p>
                    </section>
                )}

                {picks.length > 0 ? (
                    <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {picks.map((product) => (
                            <PickListCard key={product.slug} product={product} allBreedsCount={breeds.length} now={now} />
                        ))}
                    </div>
                ) : breedName ? (
                    <p className="mt-6 rounded-2xl border-[1.5px] border-dashed border-[#e2e5e8] px-5 py-10 text-center text-[15px] text-[#4b5563]">
                        No Picks for {breedName} yet. <Link href="/picks" className="font-semibold underline">See all Picks</Link>
                    </p>
                ) : (
                    <p className="mt-6 text-[15px] text-[#56616a]">
                        No Picks are published right now. Our guides by <Link href="/dogs" className="font-semibold underline">breed</Link> and{' '}
                        <Link href="/solutions" className="font-semibold underline">problem</Link> are open meanwhile.
                    </p>
                )}
            </div>

            {allPicks.length > 0 && (
                <section className="bg-[#f4f5f6] py-[46px]">
                    <div className="mx-auto max-w-[1180px] px-4">
                        <div className="mx-auto mb-8 max-w-[700px] text-center">
                            <span className="inline-block rounded-[3px] bg-white px-[11px] py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#8f4a1f] shadow-[0_2px_8px_rgba(44,56,64,0.08)]">
                                How We Choose
                            </span>
                            <h2 className="mt-3.5 text-[clamp(25px,3.4vw,35px)] font-bold tracking-[-0.01em] text-[#2c3840]">
                                Every pick has to earn its place.
                            </h2>
                            <div className="mx-auto mt-3.5 h-[3px] w-11 rounded-sm bg-[#df8448]" aria-hidden="true" />
                        </div>
                        <div className="grid gap-[18px] md:grid-cols-3">
                            {HOW_WE_CHOOSE.map(({ icon: Icon, title, text }) => (
                                <div key={title} className="rounded-[14px] bg-white p-[22px] shadow-[0_4px_18px_rgba(44,56,64,0.06)]">
                                    <span className="mb-3 grid h-[42px] w-[42px] place-items-center rounded-full bg-[#fdf2ea]">
                                        <Icon size={20} strokeWidth={2} className="text-[#c9713a]" aria-hidden="true" />
                                    </span>
                                    <h3 className="mb-1.5 text-[16.5px] font-semibold text-[#2c3840]">{title}</h3>
                                    <p className="text-[14.5px] leading-6 text-[#4b5563]">{text}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}
        </>
    );
}
