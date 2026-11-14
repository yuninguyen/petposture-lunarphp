import { stripHtml } from './text';

export const META_DESCRIPTION_MAX_LENGTH = 160;

const ENTITIES: Record<string, string> = {
    '&amp;': '&',
    '&nbsp;': ' ',
    '&quot;': '"',
    '&#39;': "'",
    '&lt;': '<',
    '&gt;': '>',
};

/**
 * Turns admin-entered text into a meta description: the rich-text editor saves
 * HTML, which must not reach a <meta> tag, and search results cut the text off
 * at roughly this length anyway, so cut it ourselves on a word boundary.
 */
export function toMetaDescription(
    value: string | null | undefined,
    maxLength = META_DESCRIPTION_MAX_LENGTH,
): string | null {
    const plain = stripHtml(value ?? '')
        .replace(/&(?:amp|nbsp|quot|#39|lt|gt);/g, (entity) => ENTITIES[entity])
        .replace(/\s+/g, ' ')
        .trim();

    if (!plain) return null;
    if (plain.length <= maxLength) return plain;

    const head = plain.slice(0, maxLength - 1);
    const lastSpace = head.lastIndexOf(' ');

    return `${(lastSpace > maxLength / 2 ? head.slice(0, lastSpace) : head).trimEnd()}…`;
}

/** First candidate with real text wins; the fallback is used as-is. */
export function firstMetaDescription(
    candidates: (string | null | undefined)[],
    fallback: string,
): string {
    for (const candidate of candidates) {
        const description = toMetaDescription(candidate);
        if (description) return description;
    }

    return fallback;
}
