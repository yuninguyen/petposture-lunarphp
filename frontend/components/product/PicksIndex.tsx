import Link from 'next/link';
import { humanizeSlug, type PickProduct } from '@/lib/pick';
import { PickCard } from './PickCard';

const chipClass = (active: boolean) =>
    `inline-flex items-center rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors ${
        active ? 'border-[#2d3a43] bg-[#2d3a43] text-white' : 'border-[#e8e1d8] bg-white text-[#2d3a43] hover:border-[#2d3a43]'
    }`;

// The list of PetPosture Picks, optionally narrowed to one breed. No cart, price or stock here:
// a Pick is a recommendation, and its retailer price lives only on its own page with the date it was checked.
export function PicksIndex({ picks, breeds, breed }: { picks: PickProduct[]; breeds: string[]; breed: string | null }) {
    const breedName = breed ? humanizeSlug(breed) : null;

    return (
        <div className="mx-auto max-w-[1180px] px-4 py-8 md:py-12">
            <nav aria-label="Breadcrumb" className="mb-6 text-[13px] text-[#56616a]">
                <ol className="flex flex-wrap items-center gap-2">
                    <li>
                        <Link href="/" className="hover:underline">Home</Link>
                    </li>
                    <li aria-hidden="true">›</li>
                    <li aria-current="page" className="font-semibold text-[#2d3a43]">Picks</li>
                </ol>
            </nav>

            <h1 className="text-[28px] font-bold leading-tight text-[#2d3a43] md:text-[36px]">PetPosture Picks</h1>
            <p className="mt-3 max-w-[640px] text-[15px] leading-7 text-[#56616a]">
                Products we looked at for dogs with a particular body shape, with what we like and what to know first.
            </p>

            {breeds.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-2">
                    <Link href="/picks" className={chipClass(!breed)} {...(!breed ? { 'aria-current': 'true' } : {})}>All</Link>
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
            )}

            {breedName && <p className="mt-6 text-[14px] font-semibold text-[#2d3a43]">Showing Picks for {breedName}</p>}

            {picks.length > 0 ? (
                <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {picks.map((product) => (
                        <PickCard key={product.slug} product={product} />
                    ))}
                </div>
            ) : breedName ? (
                <p className="mt-6 text-[15px] text-[#56616a]">
                    No Picks for {breedName} yet. <Link href="/picks" className="font-semibold underline">See all Picks</Link>
                </p>
            ) : (
                <p className="mt-6 text-[15px] text-[#56616a]">
                    No Picks are published right now. Our guides by <Link href="/dogs" className="font-semibold underline">breed</Link> and{' '}
                    <Link href="/solutions" className="font-semibold underline">problem</Link> are open meanwhile.
                </p>
            )}
        </div>
    );
}
