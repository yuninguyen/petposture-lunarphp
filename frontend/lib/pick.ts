import type { ProductPick } from '@/types/shop';

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
export function pickPriceLine(pick: ProductPick): string | null {
    if (pick.referencePrice === null || pick.priceCheckedDate === null) return null;

    const name = retailerName(pick);

    return `${name ? `Price on ${name}` : 'Retailer price'}: $${pick.referencePrice.toFixed(2)} (checked ${formatPickDate(pick.priceCheckedDate)}) — check current price`;
}
