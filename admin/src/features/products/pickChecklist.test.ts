import { describe, expect, it } from 'vitest';
import { pickChecklist, type PickChecklistInput } from './pickChecklist';

const TODAY = '2026-11-22';
const base: PickChecklistInput = {
  media: [{ alt: 'Front view' }, { alt: 'Side view' }],
  brandId: 7,
  attributes: { reference_price: '45.95', price_checked_date: '2026-11-17', best_for_breeds: 'pug,french-bulldog', solution_tags: 'mobility-support' },
  handles: ['reference_price', 'best_for_breeds', 'solution_tags'],
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

  it('checks the second store only when one is set, with its own price and date', () => {
    expect(item(base, 'second_price')).toBeUndefined();

    const withSecond = { ...base, attributes: { ...base.attributes, second_retailer_slug: 'petsmart', second_retailer_url: 'https://www.petsmart.com/x' } };
    expect(item(withSecond, 'second_price')).toMatchObject({ status: 'missing', detail: 'products.checklist.detail.price_missing' });

    const priced = { ...withSecond, attributes: { ...withSecond.attributes, second_retailer_price: '40.99', second_retailer_price_checked_date: '2026-09-01' } };
    expect(item(priced, 'second_price')).toMatchObject({ status: 'warn', detail: 'products.checklist.detail.price_old' });

    const fresh = { ...priced, attributes: { ...priced.attributes, second_retailer_price_checked_date: '2026-11-21' } };
    expect(item(fresh, 'second_price')).toMatchObject({ status: 'ok' });
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
