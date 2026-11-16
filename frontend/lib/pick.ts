import type { Product, ProductPick } from '@/types/shop';

export type PickProduct = Product & { pick: ProductPick };

/** Every breed some Pick is best for, once each and sorted, for the filter chips of the Picks list. */
export function pickBreeds(picks: PickProduct[]): string[] {
    return [...new Set(picks.flatMap((product) => product.pick.bestForBreeds))].sort();
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
