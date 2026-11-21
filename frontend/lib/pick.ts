import type { PickVariant, Product, ProductPick, SecondRetailer } from '@/types/shop';

export type PickProduct = Product & { pick: ProductPick };

export const PICK_DISCLOSURE = 'PetPosture may earn a commission if you buy through this link, at no extra cost to you.';
/** The same sentence for a price table with two stores, where there is more than one link. */
export const PICK_DISCLOSURE_MANY = 'PetPosture may earn a commission if you buy through these links, at no extra cost to you.';

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

/** How many Picks the list shows on one page; the rest are on the next pages. */
export const PICKS_PER_PAGE = 12;

/**
 * The list URL for a combination of filters, so a chip in one row keeps what was chosen in the other.
 * A filter link leaves `page` out, which starts again from the first page; page 1 never carries a `page` parameter.
 */
export function picksHref({ breed, solution, page }: { breed: string | null; solution: string | null; page?: number | null }): string {
    const params = new URLSearchParams();
    if (breed) params.set('breed', breed);
    if (solution) params.set('solution', solution);
    if (page && page > 1) params.set('page', String(page));
    const query = params.toString();

    return query ? `/picks?${query}` : '/picks';
}

/** One page of the list. A page below 1 or not a number is the first; one past the end is the last. */
export function paginatePicks<T>(items: T[], page: number): { items: T[]; page: number; pages: number; total: number; from: number; to: number } {
    const pages = Math.max(1, Math.ceil(items.length / PICKS_PER_PAGE));
    const current = Math.min(Math.max(1, Math.floor(page) || 1), pages);
    const start = (current - 1) * PICKS_PER_PAGE;

    return {
        items: items.slice(start, start + PICKS_PER_PAGE),
        page: current,
        pages,
        total: items.length,
        from: items.length === 0 ? 0 : start + 1,
        to: Math.min(start + PICKS_PER_PAGE, items.length),
    };
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

function isFreshDate(isoDate: string | null | undefined, now: Date): boolean {
    if (!isoDate) return false;

    const checked = new Date(`${isoDate}T00:00:00Z`).getTime();
    if (Number.isNaN(checked)) return false;

    const ageDays = Math.floor((now.getTime() - checked) / DAY_MS);

    return ageDays >= 0 && ageDays <= PICK_PRICE_MAX_AGE_DAYS;
}

export function isPickPriceFresh(pick: ProductPick, now: Date): boolean {
    return isFreshDate(pick.priceCheckedDate, now);
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

function ctaLabelFor(name: string | null): string {
    if (name === 'Chewy' || name === 'PetSmart') return `Buy on ${name}`;
    if (name === 'Amazon') return 'Check Price on Amazon';

    return name ? `View on ${name}` : 'View on the retailer site';
}

/** The button text must name the store the button actually opens. */
export function pickCtaLabel(pick: ProductPick): string {
    return ctaLabelFor(retailerName(pick));
}

/** The text of the button for a second store, named the same way as the first button. */
export function pickSecondCtaLabel(second: SecondRetailer): string {
    return ctaLabelFor(second.retailerName ?? (second.retailer ? humanizeSlug(second.retailer) : null));
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

/** The stores whose logo is on the site, cropped to the artwork so the height alone sets the size. Any other store is named in text. */
const RETAILER_LOGOS: Record<string, { src: string; width: number; height: number }> = {
    chewy: { src: '/images/retailers/chewy.png', width: 396, height: 118 },
    petsmart: { src: '/images/retailers/petsmart.png', width: 516, height: 132 },
};

/** A store has to be this much cheaper (in cents) before the table says so; one cent is not a saving. */
export const PICK_SAVE_MIN_CENTS = 100;

/** One store of the price table: its name or logo, its own price with the date it was checked, and its tracked button. */
export interface PickPriceRow {
    slot: 'first' | 'second';
    name: string;
    logo: { src: string; width: number; height: number } | null;
    /** "$64.99", or null when there is no price (none entered, no date, or a store whose price cannot be compared). */
    price: string | null;
    cents: number | null;
    checkedDate: string | null;
    /** "17 Nov 2026" */
    checked: string | null;
    goUrl: string;
    /** The visible button text. */
    buttonLabel: string;
    /** What the button does, for a screen reader: "Buy on Chewy". */
    ariaLabel: string;
}

function priceRow(slot: PickPriceRow['slot'], name: string, slug: string | null, price: number | null, checkedDate: string | null, goUrl: string, ariaLabel: string): PickPriceRow {
    const shown = price !== null && checkedDate !== null;

    return {
        slot,
        name,
        logo: RETAILER_LOGOS[(slug ?? name).toLowerCase()] ?? null,
        price: shown ? `$${price.toFixed(2)}` : null,
        cents: shown ? Math.round(price * 100) : null,
        checkedDate: shown ? checkedDate : null,
        checked: shown ? formatPickDate(checkedDate) : null,
        goUrl,
        // The button names no store (the logo beside it does); Amazon keeps its "Check Price" wording.
        buttonLabel: name === 'Amazon' ? 'Check Price' : 'Buy',
        ariaLabel,
    };
}

/**
 * The rows of the price table: the first store, then the second when the admin set one. A price is only shown with
 * the date it was checked. The first store's price follows the chosen variant; the second store's link is for the one
 * product that was checked, so when the reader can choose between variants it has no price (and nothing to compare).
 */
export function pickPriceRows(pick: ProductPick, selected: PickVariant | null, hasVariantChoice: boolean): PickPriceRow[] {
    const rows = [
        priceRow('first', retailerName(pick) ?? 'Retailer', pick.retailer, selected ? selected.referencePrice : pick.referencePrice, pick.priceCheckedDate, selected?.goUrl ?? pick.goUrl, pickCtaLabel(pick)),
    ];
    const second = pick.secondRetailer;

    if (second) {
        const name = second.retailerName ?? (second.retailer ? humanizeSlug(second.retailer) : 'Retailer');
        const comparable = !hasVariantChoice;

        rows.push(priceRow('second', name, second.retailer, comparable ? (second.price ?? null) : null, comparable ? (second.priceCheckedDate ?? null) : null, second.goUrl, pickSecondCtaLabel(second)));
    }

    return rows;
}

/**
 * Which store is the cheaper one, and by how much, or null when there is nothing fair to say: one store only, a price
 * missing, a check older than the 30 days a price may be called current, or a difference under a dollar.
 */
export function pickLowerPrice(rows: PickPriceRow[], now: Date): { slot: PickPriceRow['slot']; save: string } | null {
    const [first, second] = rows;

    if (!first || !second || first.cents === null || second.cents === null) return null;
    if (!isFreshDate(first.checkedDate, now) || !isFreshDate(second.checkedDate, now)) return null;

    const difference = first.cents - second.cents;
    if (Math.abs(difference) < PICK_SAVE_MIN_CENTS) return null;

    return { slot: difference > 0 ? 'second' : 'first', save: `$${(Math.abs(difference) / 100).toFixed(2)}` };
}

/**
 * The line under "Compare prices" that says which product the prices are for: the colour and size from the quick
 * specs ("Mist Gray · Large"), the size cut where a longer note starts ("Medium: 24 to 34-in chest"). A Pick with a
 * variant chooser says it in the chooser instead.
 */
export function pickVariantLine(pick: ProductPick): string | null {
    const spec = (labels: string[]) => {
        const found = pick.quickSpecs.find((item) => labels.includes(item.label.trim().toLowerCase()));

        return found ? found.value.split(/\s+[—–-]\s+|:/)[0].trim() : '';
    };

    return [spec(['color', 'colour']), spec(['size'])].filter(Boolean).join(' · ') || null;
}
