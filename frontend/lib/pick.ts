import type { Product, ProductPick } from '@/types/shop';

export type PickProduct = Product & { pick: ProductPick };

export const PICK_DISCLOSURE = 'PetPosture may earn a commission if you buy through this link, at no extra cost to you.';

/** Every breed some Pick is best for, once each and sorted, for the filter chips of the Picks list. */
export function pickBreeds(picks: PickProduct[]): string[] {
    return [...new Set(picks.flatMap((product) => product.pick.bestForBreeds))].sort();
}

// The solutions of the site come first, in the order of its menu; any other tag follows alphabetically.
const SOLUTION_ORDER = ['feeding', 'comfort', 'mobility', 'walking'];

/** Every solution some Pick is tagged with, once each: the options of the solution filter. Empty until Picks are tagged. */
export function pickSolutions(picks: PickProduct[]): string[] {
    const rank = (slug: string) => {
        const index = SOLUTION_ORDER.indexOf(slug);

        return index === -1 ? SOLUTION_ORDER.length : index;
    };

    return [...new Set(picks.flatMap((product) => product.solutionTags ?? []))].sort(
        (a, b) => rank(a) - rank(b) || a.localeCompare(b),
    );
}

/** The Picks tagged with a solution; no solution means all of them, an unknown one means none. */
export function filterPicksBySolution(picks: PickProduct[], solution: string | null): PickProduct[] {
    return solution ? picks.filter((product) => (product.solutionTags ?? []).includes(solution)) : picks;
}

/** The list URL for a combination of filters, so a chip in one row keeps what was chosen in the other. */
export function picksHref({ breed, solution }: { breed: string | null; solution: string | null }): string {
    const params = new URLSearchParams();
    if (breed) params.set('breed', breed);
    if (solution) params.set('solution', solution);
    const query = params.toString();

    return query ? `/picks?${query}` : '/picks';
}

/** The Picks that are best for a breed; no breed means all of them, an unknown breed means none. */
export function filterPicksByBreed(picks: PickProduct[], breed: string | null): PickProduct[] {
    return breed ? picks.filter((product) => product.pick.bestForBreeds.includes(breed)) : picks;
}

/**
 * Where the Picks come from: the newest products, of which the Picks are kept. 100 is the API's
 * page limit, plenty while the catalogue is small; a backend filter would be needed beyond that.
 */
export const PICKS_PATH = '/api/products?per_page=100';

/**
 * The products that are Picks. Stock is deliberately not looked at: PetPosture does not hold
 * stock for a Pick, so a variant with stock 0 is still a Pick.
 */
export function pickProducts(products: Product[]): PickProduct[] {
    return products.filter((product): product is PickProduct => Boolean(product.pick));
}

/** A price on a list card is hidden once its check date is older than this; the Pick page keeps showing it with its date. */
export const PICK_PRICE_MAX_AGE_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export function isPickPriceFresh(pick: ProductPick, now: Date): boolean {
    if (!pick.priceCheckedDate) return false;

    const checked = new Date(`${pick.priceCheckedDate}T00:00:00Z`).getTime();
    if (Number.isNaN(checked)) return false;

    const ageDays = Math.floor((now.getTime() - checked) / DAY_MS);

    return ageDays >= 0 && ageDays <= PICK_PRICE_MAX_AGE_DAYS;
}

/** The price line of a list card: the Pick page's price parts, but only while the check is recent enough. */
export function pickCardPrice(pick: ProductPick, now: Date): ReturnType<typeof pickPriceParts> {
    return isPickPriceFresh(pick, now) ? pickPriceParts(pick) : null;
}

/**
 * The short take for a list card. Every take opens with "we haven't tested this ourselves", which the list header
 * already says once for all Picks, so that sentence is dropped and the rest is cut at a word boundary.
 */
export function pickTakeSummary(ourTake: string | null | undefined, maxLength = 150): string | null {
    if (!ourTake) return null;

    const kept = ourTake
        .split(/(?<=[.!?])\s+/)
        .filter((sentence) => !/haven['’]t tested/i.test(sentence))
        .join(' ')
        .trim();

    if (!kept) return null;
    if (kept.length <= maxLength) return kept;

    return `${kept.slice(0, maxLength).replace(/\s+\S*$/, '')}…`;
}

/** What the list header may claim, worked out from the Picks themselves rather than typed in. */
export function pickListStats(picks: PickProduct[]): { count: number; latestChecked: string | null; everyPickHasCons: boolean } {
    const dates = picks.map((product) => product.pick.priceCheckedDate).filter((date): date is string => Boolean(date));

    return {
        count: picks.length,
        latestChecked: dates.length ? dates.reduce((latest, date) => (date > latest ? date : latest)) : null,
        everyPickHasCons: picks.length > 0 && picks.every((product) => product.pick.cons.length > 0),
    };
}

export const RELATED_PICK_COUNT = 3;

/**
 * The Picks to suggest under a Pick: the others, the ones for a shared breed first. They are matched on "id":
 * the API sends no "productId" (the Product type still declares one), and comparing on it left this list empty.
 */
export function relatedPicks(
    products: Product[],
    currentId: number,
    breeds: string[] = [],
    count: number = RELATED_PICK_COUNT,
): PickProduct[] {
    const others = pickProducts(products).filter((candidate) => candidate.id !== currentId);
    const sharesBreed = (candidate: PickProduct) => candidate.pick.bestForBreeds.some((breed) => breeds.includes(breed));

    return [...others.filter(sharesBreed), ...others.filter((candidate) => !sharesBreed(candidate))].slice(0, count);
}

/** The site adds this to every page title (see the title template in app/layout.tsx). */
const TITLE_SUFFIX = ' | PetPosture';

/** Search tools flag a whole title (name plus suffix) longer than this. */
export const PICK_TITLE_MAX = 70;

/**
 * The page title of a Pick, made from its name. A name that already fits is used as it is. A longer one loses its
 * trailing details one at a time, each after the last comma or colon (the size, "12 to 17-in chest"), until the whole
 * title fits; a name with no such break is cut at a word and ends in an ellipsis. The name shown on the page is
 * never changed, and a title typed in the admin is used instead of this.
 */
export function pickSeoTitle(name: string): string {
    const limit = PICK_TITLE_MAX - TITLE_SUFFIX.length;
    let title = name.trim();

    while (title.length > limit) {
        const cut = Math.max(title.lastIndexOf(', '), title.lastIndexOf(': '));
        if (cut <= 0) break;
        title = title.slice(0, cut);
    }

    if (title.length > limit) title = `${title.slice(0, limit - 1).replace(/\s+\S*$/, '')}…`;

    return title;
}

/** "french-bulldog" -> "French Bulldog" */
export function humanizeSlug(slug: string): string {
    return slug
        .split('-')
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function retailerName(pick: ProductPick): string | null {
    return pick.retailerName ?? (pick.retailer ? humanizeSlug(pick.retailer) : null);
}

export { retailerName as pickRetailerName };

/** The button text must name the store the button actually opens. */
export function pickCtaLabel(pick: ProductPick): string {
    const name = retailerName(pick);

    if (name === 'Chewy') return 'Buy on Chewy';
    if (name === 'Amazon') return 'Check Price on Amazon';

    return name ? `View on ${name}` : 'View on the retailer site';
}

/** "2026-11-14" -> "14 Nov 2026", read as a calendar date so no timezone can move it a day. */
export function formatPickDate(isoDate: string): string {
    return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
    });
}

/**
 * The price is the retailer's, never PetPosture's, so it only appears with the date it was
 * checked. Without both, there is no price line at all.
 */
export function pickPriceParts(pick: ProductPick): { label: string; amount: string; note: string } | null {
    if (pick.referencePrice === null || pick.priceCheckedDate === null) return null;

    const name = retailerName(pick);

    return {
        label: name ? `Price at ${name}` : 'Retailer price',
        amount: `$${pick.referencePrice.toFixed(2)}`,
        note: `Checked ${formatPickDate(pick.priceCheckedDate)} — check current price`,
    };
}
