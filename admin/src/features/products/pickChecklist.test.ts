import { describe, expect, it } from 'vitest';
import { pickChecklist, type PickChecklistInput } from './pickChecklist';

const TODAY = '2026-11-22';
const base: PickChecklistInput = {
  media: [{ alt: 'Front view' }, { alt: 'Side view' }],
  brandId: 7,
  attributes: { reference_price: '45.95', price_checked_date: '2026-11-17', best_for_breeds: 'pug,french-bulldog', solution_tags: 'mobility-support' },
  handles: ['reference_price', 'best_for_breeds', 'solution_tags'],
  merchants: [],
  networkNames: { 4: 'PetSmart', 5: 'Amazon' },
  today: TODAY,
};
const item = (input: PickChecklistInput, id: string) => pickChecklist(input).find((entry) => entry.id === id);

describe('pickChecklist', () => {
  it('has no gaps for a complete Pick and always ends with the reminder about the honest take', () => {
    const items = pickChecklist(base);

    expect(items.map((entry) => entry.id)).toEqual(['alt', 'brand', 'price', 'photos', 'breeds', 'solutions', 'honest_take']);
    expect(items.filter((entry) => entry.id !== 'honest_take').every((entry) => entry.status === 'ok')).toBe(true);
    expect(items[items.length - 1]).toMatchObject({ id: 'honest_take', status: 'note' });
  });

  it('lists the images that have no alt text by position', () => {
    const result = item({ ...base, media: [{ alt: 'Front' }, { alt: '  ' }, { alt: '' }] }, 'alt');

    expect(result).toMatchObject({ status: 'missing', detail: 'products.checklist.detail.alt_missing', params: { positions: '2, 3' } });
  });

  it('reports no images for the alt text and the photos lines alike', () => {
    expect(item({ ...base, media: [] }, 'alt')).toMatchObject({ status: 'missing', detail: 'products.checklist.detail.alt_no_images' });
    expect(item({ ...base, media: [] }, 'photos')).toMatchObject({ status: 'missing', detail: 'products.checklist.detail.photos_none' });
  });

  it('warns when only the main photo is there', () => {
    expect(item({ ...base, media: [{ alt: 'Front' }] }, 'photos')).toMatchObject({ status: 'warn', detail: 'products.checklist.detail.photos_one' });
  });

  it('asks for a brand', () => {
    expect(item({ ...base, brandId: null }, 'brand')).toMatchObject({ status: 'missing' });
  });

  it('wants a price, then the date it was checked', () => {
    expect(item({ ...base, attributes: { ...base.attributes, reference_price: '' } }, 'price')).toMatchObject({ status: 'missing', detail: 'products.checklist.detail.price_missing' });
    expect(item({ ...base, attributes: { ...base.attributes, price_checked_date: '' } }, 'price')).toMatchObject({ status: 'missing', detail: 'products.checklist.detail.date_missing' });
    expect(item({ ...base, attributes: { ...base.attributes, price_checked_date: '17/11/2026' } }, 'price')).toMatchObject({ status: 'missing', detail: 'products.checklist.detail.date_invalid' });
    expect(item({ ...base, attributes: { ...base.attributes, price_checked_date: '2026-02-31' } }, 'price')).toMatchObject({ status: 'missing', detail: 'products.checklist.detail.date_invalid' });
  });

  it('warns once a price is more than 30 days old, not at exactly 30', () => {
    const at = (date: string) => item({ ...base, attributes: { ...base.attributes, price_checked_date: date } }, 'price');

    expect(at('2026-10-23')).toMatchObject({ status: 'ok', params: { days: 30 } });
    expect(at('2026-10-22')).toMatchObject({ status: 'warn', detail: 'products.checklist.detail.price_old', params: { days: 31 } });
    expect(at('2026-12-01')).toMatchObject({ status: 'warn', detail: 'products.checklist.detail.date_future' });
  });

  it('adds one line per other store, named after it, with its own price and date', () => {
    expect(item(base, 'store_0')).toBeUndefined();

    const store = { affiliate_network_id: 4, url: 'https://www.petsmart.com/x', price: '', price_checked_date: '' };
    const noPrice = { ...base, merchants: [store] };
    expect(item(noPrice, 'store_0')).toMatchObject({ status: 'missing', detail: 'products.checklist.detail.price_missing', label: 'products.checklist.items.store_price', labelParams: { name: 'PetSmart' } });

    const old = { ...base, merchants: [{ ...store, price: '40.99', price_checked_date: '2026-09-01' }] };
    expect(item(old, 'store_0')).toMatchObject({ status: 'warn', detail: 'products.checklist.detail.price_old' });

    const fresh = { ...base, merchants: [{ ...store, price: '40.99', price_checked_date: '2026-11-21' }] };
    expect(item(fresh, 'store_0')).toMatchObject({ status: 'ok' });
  });

  it('lists every store on its own line, in order, and does not mix their prices up', () => {
    const merchants = [
      { affiliate_network_id: 4, url: 'https://www.petsmart.com/x', price: '40.99', price_checked_date: '2026-11-21' },
      { affiliate_network_id: 5, url: 'https://www.amazon.com/x', price: '', price_checked_date: '' },
    ];
    const ids = pickChecklist({ ...base, merchants }).map((entry) => entry.id);

    expect(ids).toEqual(['alt', 'brand', 'price', 'store_0', 'store_1', 'photos', 'breeds', 'solutions', 'honest_take']);
    expect(item({ ...base, merchants }, 'store_0')).toMatchObject({ status: 'ok', labelParams: { name: 'PetSmart' } });
    expect(item({ ...base, merchants }, 'store_1')).toMatchObject({ status: 'missing', labelParams: { name: 'Amazon' } });
  });

  it('asks for the merchant and the link when a store is half filled in', () => {
    for (const store of [
      { affiliate_network_id: null, url: 'https://www.petsmart.com/x', price: '', price_checked_date: '' },
      { affiliate_network_id: 4, url: '  ', price: '', price_checked_date: '' },
    ]) {
      expect(item({ ...base, merchants: [store] }, 'store_0')).toMatchObject({ status: 'missing', detail: 'products.checklist.detail.store_incomplete' });
    }
    // a store with no merchant chosen is named by its place in the list, not by a bare number
    expect(item({ ...base, merchants: [{ affiliate_network_id: null, url: '', price: '', price_checked_date: '' }] }, 'store_0')).toMatchObject({ label: 'products.checklist.items.store_unnamed', labelParams: { number: 2 } });
  });

  it('asks for the breeds and the solution tags, and skips the tags when the product type has none', () => {
    const empty = { ...base, attributes: { ...base.attributes, best_for_breeds: '  ', solution_tags: '' } };

    expect(item(empty, 'breeds')).toMatchObject({ status: 'missing' });
    expect(item(empty, 'solutions')).toMatchObject({ status: 'missing' });
    expect(item({ ...empty, handles: ['reference_price', 'best_for_breeds'] }, 'solutions')).toBeUndefined();
  });

  it('reads the English text of a translated attribute', () => {
    const translated = { ...base, attributes: { ...base.attributes, best_for_breeds: { en: 'pug', vi: '' } } };

    expect(item(translated, 'breeds')).toMatchObject({ status: 'ok' });
  });

  it('never produces a total score', () => {
    const json = JSON.stringify(pickChecklist(base));

    expect(json).not.toMatch(/score|\/100/i);
  });
});
