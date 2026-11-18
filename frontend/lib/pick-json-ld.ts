import { toMetaDescription } from './meta-description';
import type { PickProduct } from './pick';

const trimmed = (items: string[]) => items.map((item) => item.trim()).filter(Boolean);

const noteList = (items: string[]) => ({
    '@type': 'ItemList',
    itemListElement: items.map((name, index) => ({ '@type': 'ListItem', position: index + 1, name })),
});

// PetPosture's own take as a Review, in the "Pros and cons" shape of Google's product snippet guide: PetPosture
// is the author, "Our take" is the body, Pros and Cons are the positive and negative notes, and the date the
// price was last checked is the date of the review. There is deliberately no reviewRating: PetPosture does not
// score products. Google asks for at least two notes in all, so the notes are left out below that; without a
// take and without notes there is no review at all.
function buildPickReview(product: PickProduct): Record<string, unknown> | null {
    const { pick } = product;
    const body = (pick.ourTake ?? '').trim();
    const pros = trimmed(pick.pros);
    const cons = trimmed(pick.cons);
    const hasNotes = pros.length + cons.length >= 2;

    if (!body && !hasNotes) return null;

    const review: Record<string, unknown> = {
        '@type': 'Review',
        name: `PetPosture's take on ${product.name}`,
        author: { '@type': 'Organization', name: 'PetPosture' },
    };

    if (pick.priceCheckedDate) review.datePublished = pick.priceCheckedDate;
    if (body) review.reviewBody = body;
    if (hasNotes && pros.length > 0) review.positiveNotes = noteList(pros);
    if (hasNotes && cons.length > 0) review.negativeNotes = noteList(cons);

    return review;
}

// Structured data for a Pick page. PetPosture does not sell a Pick, so the Product carries no offer,
// price, stock level, SKU or rating: the price and any star rating belong to the retailer and are shown on
// the page as text with their date only. It does carry PetPosture's own review (see buildPickReview).
export function buildPickJsonLd(siteUrl: string, product: PickProduct) {
    const ld: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        url: `${siteUrl}/picks/${product.slug}`,
    };

    const description = toMetaDescription(product.description);
    if (description) ld.description = description;

    const image = product.images?.find((candidate) => candidate.src)?.src || product.image;
    if (image) ld.image = image;

    if (product.brand) ld.brand = { '@type': 'Brand', name: product.brand };

    const review = buildPickReview(product);
    if (review) ld.review = review;

    return ld;
}

export function buildPickBreadcrumbJsonLd(siteUrl: string, product: Pick<PickProduct, 'name' | 'slug'>) {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
            { '@type': 'ListItem', position: 2, name: 'Picks', item: `${siteUrl}/picks` },
            { '@type': 'ListItem', position: 3, name: product.name, item: `${siteUrl}/picks/${product.slug}` },
        ],
    };
}

// Text typed in the admin ends up in a <script>, so "<" is escaped and "</script>" cannot close it early.
export function serializeJsonLd(value: unknown): string {
    return JSON.stringify(value).replace(/</g, '\\u003c');
}
