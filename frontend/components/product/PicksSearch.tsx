import Link from 'next/link';
import { ArrowRight, Search } from 'lucide-react';
import { picksHref, type PickSort } from '@/lib/pick';

/** Quick searches under the box; each one is a plain link, so they work without scripts. */
export const POPULAR_SEARCHES = ['rabbitgoo', 'harness', 'bowl', 'feeder'];

const labelClass = 'mb-[7px] text-[11px] font-bold uppercase tracking-[0.06em] text-[#3e4c57]';

/**
 * The right column of the filter bar: a search box with its small round submit arrow inside it, and the
 * Popular chips under it. A plain GET form to /picks, so the words, the sort and the breed and solution already
 * chosen all live in the address; it sends no `page`, so a new search starts again from page 1.
 */
export function PicksSearch({ breed, solution, q, sort }: { breed: string | null; solution: string | null; q: string | null; sort: PickSort }) {
    return (
        <div className="w-full shrink-0 lg:w-[270px]">
            <p className={labelClass}>Search picks</p>
            <form action="/picks" method="get" role="search" className="flex h-10 items-center rounded-xl border border-[#e4e4e7] bg-white focus-within:border-[#df8448] focus-within:shadow-[0_0_0_3px_#fdf2ea]">
                {breed && <input type="hidden" name="breed" value={breed} />}
                {solution && <input type="hidden" name="solution" value={solution} />}
                {sort !== 'featured' && <input type="hidden" name="sort" value={sort} />}
                <Search size={16} className="ml-3 shrink-0 text-[#c9713a]" aria-hidden="true" />
                <input
                    type="search"
                    name="q"
                    defaultValue={q ?? ''}
                    maxLength={100}
                    placeholder="Search by name or brand…"
                    aria-label="Search Picks"
                    className="min-w-0 flex-1 border-0 bg-transparent px-2.5 text-[13px] text-[#2c3840] outline-none placeholder:text-[#a1a1aa]"
                />
                <button
                    type="submit"
                    aria-label="Search"
                    className="mr-1.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#df8448] text-[#2c3840] transition-colors hover:bg-[#c9713a] hover:text-white"
                >
                    <ArrowRight size={15} aria-hidden="true" />
                </button>
            </form>
            <div className="mt-2.5">
                <p className={labelClass}>Popular</p>
                <div className="flex flex-wrap gap-1.5">
                    {POPULAR_SEARCHES.map((word) => (
                        <Link
                            key={word}
                            href={picksHref({ breed, solution, q: word, sort })}
                            className="inline-flex items-center rounded-full border border-[#f5d9c4] bg-[#fdf2ea] px-[11px] py-[5px] text-[12px] text-[#c9713a] hover:border-[#df8448]"
                        >
                            {word}
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
