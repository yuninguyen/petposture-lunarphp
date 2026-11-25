import type { Metadata } from 'next';

const HAS_BRAND_SUFFIX = /\|\s*PetPosture\s*$/i;

/**
 * The root layout adds " | PetPosture" to every page title. A title typed in the admin may already end with it, so
 * that one is marked "absolute", which keeps the layout from adding it a second time.
 */
export function pageTitle(title: string): NonNullable<Metadata['title']> {
    return HAS_BRAND_SUFFIX.test(title) ? { absolute: title } : title;
}
