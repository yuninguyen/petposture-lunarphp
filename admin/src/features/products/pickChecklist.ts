import type { ChecklistItem } from '@/lib/checklist';
import type { AttributeValue } from './api';

// A checklist, not a score: each line says whether one thing a Pick needs is there. Nothing here is saved or sent;
// it only reads what the form currently holds, so it updates as the fields are typed.

export interface PickChecklistInput {
  media: { alt: string }[];
  brandId: number | null;
  attributes: Record<string, AttributeValue | undefined>;
  /** The attribute handles this product has at all, so a field the product type does not offer is not asked for. */
  handles: string[];
  /** The stores after the first one, as they are in the form right now. */
  merchants: { affiliate_network_id: number | null; url: string; price: string; price_checked_date: string }[];
  /** Store names by network id, to name each store's line. */
  networkNames: Record<number, string>;
  /** Today as YYYY-MM-DD (UTC), passed in so the check is the same in a test as in the browser. */
  today: string;
}

/** A price older than this many days is shown as a warning. The storefront stops showing the "Lower price" label at the same age. */
export const PRICE_MAX_AGE_DAYS = 30;

function textOf(value: AttributeValue | undefined): string {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object' && 'en' in value) return String((value as { en?: string }).en ?? '').trim();

  return '';
}

function dayNumber(date: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!match) return null;

  const [year, month, day] = match.slice(1).map(Number);
  const time = Date.UTC(year, month - 1, day);
  const check = new Date(time);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;

  return Math.floor(time / 86_400_000);
}

function priceItem(id: string, price: string, checked: string, today: string): ChecklistItem {
  if (price === '') return { id, status: 'missing', detail: 'products.checklist.detail.price_missing' };
  if (checked === '') return { id, status: 'missing', detail: 'products.checklist.detail.date_missing' };

  const checkedDay = dayNumber(checked);
  const todayDay = dayNumber(today);
  if (checkedDay === null || todayDay === null) return { id, status: 'missing', detail: 'products.checklist.detail.date_invalid' };

  const age = todayDay - checkedDay;
  if (age < 0) return { id, status: 'warn', detail: 'products.checklist.detail.date_future', params: { date: checked } };
  if (age > PRICE_MAX_AGE_DAYS) return { id, status: 'warn', detail: 'products.checklist.detail.price_old', params: { days: age } };

  return { id, status: 'ok', detail: 'products.checklist.detail.price_fresh', params: { days: age } };
}

function filled(input: PickChecklistInput, handle: string): boolean {
  return textOf(input.attributes[handle]) !== '';
}

export function pickChecklist(input: PickChecklistInput): ChecklistItem[] {
  const items: ChecklistItem[] = [];

  // 1. Every image has alt text (the one that is forgotten most when several photos are uploaded).
  if (input.media.length === 0) {
    items.push({ id: 'alt', status: 'missing', detail: 'products.checklist.detail.alt_no_images' });
  } else {
    const without = input.media.flatMap((item, index) => (item.alt.trim() === '' ? [index + 1] : []));
    items.push(without.length === 0
      ? { id: 'alt', status: 'ok', detail: 'products.checklist.detail.alt_ok', params: { count: input.media.length } }
      : { id: 'alt', status: 'missing', detail: 'products.checklist.detail.alt_missing', params: { positions: without.join(', ') } });
  }

  // 2. Brand.
  items.push(input.brandId ? { id: 'brand', status: 'ok', detail: 'products.checklist.detail.brand_ok' } : { id: 'brand', status: 'missing', detail: 'products.checklist.detail.brand_missing' });

  // 3. Price and the date it was checked, for the first store and, when there is one, the second store.
  items.push(priceItem('price', textOf(input.attributes.reference_price), textOf(input.attributes.price_checked_date), input.today));
  input.merchants.forEach((store, index) => {
    const name = store.affiliate_network_id === null ? undefined : input.networkNames[store.affiliate_network_id];
    const result: ChecklistItem = store.affiliate_network_id === null || store.url.trim() === ''
      ? { id: '', status: 'missing', detail: 'products.checklist.detail.store_incomplete' }
      : priceItem('', store.price.trim(), store.price_checked_date.trim(), input.today);

    // A store with no merchant chosen yet is named by its place in the list.
    items.push(name
      ? { ...result, id: `store_${index}`, label: 'products.checklist.items.store_price', labelParams: { name } }
      : { ...result, id: `store_${index}`, label: 'products.checklist.items.store_unnamed', labelParams: { number: index + 2 } });
  });

  // 4. Real photos, not just the main one.
  items.push(input.media.length === 0
    ? { id: 'photos', status: 'missing', detail: 'products.checklist.detail.photos_none' }
    : input.media.length === 1
      ? { id: 'photos', status: 'warn', detail: 'products.checklist.detail.photos_one' }
      : { id: 'photos', status: 'ok', detail: 'products.checklist.detail.photos_ok', params: { count: input.media.length } });

  // 5. Best for (breeds) and solution tags.
  items.push(filled(input, 'best_for_breeds') ? { id: 'breeds', status: 'ok', detail: 'products.checklist.detail.breeds_ok' } : { id: 'breeds', status: 'missing', detail: 'products.checklist.detail.breeds_missing' });
  if (input.handles.includes('solution_tags')) {
    items.push(filled(input, 'solution_tags') ? { id: 'solutions', status: 'ok', detail: 'products.checklist.detail.solutions_ok' } : { id: 'solutions', status: 'missing', detail: 'products.checklist.detail.solutions_missing' });
  }

  // 6. A person has to judge this one; the checklist only reminds.
  items.push({ id: 'honest_take', status: 'note', detail: 'products.checklist.detail.honest_take' });

  return items;
}
