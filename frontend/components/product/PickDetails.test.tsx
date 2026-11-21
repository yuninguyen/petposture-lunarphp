// @vitest-environment jsdom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Product, ProductPick } from '../../types/shop';
import { PickDetails } from './PickDetails';

const GO_URL = 'https://api.petposture.com/go/pick/necoichi-bowl';
const OUR_TAKE = "Based on the seller's description and customer reviews — we haven't tested this ourselves.";

const pickData = (overrides: Partial<ProductPick> = {}): ProductPick => ({
    retailer: 'chewy',
    retailerName: 'Chewy',
    goUrl: GO_URL,
    referencePrice: 49.96,
    priceCheckedDate: '2026-11-14',
    bestForBreeds: ['french-bulldog', 'pug'],
    bestForNotes: ['Small, split meals'],
    ourTake: OUR_TAKE,
    problem: 'A flat bowl makes a flat-faced dog bend its neck.',
    approach: 'A tilted, raised shape brings the food closer.',
    quickSpecs: [{ label: 'Material', value: 'Porcelain' }, { label: 'Tilt', value: '15°' }],
    pros: ['Raised design', 'Easy to clean'],
    cons: ['Holds about one cup'],
    ...overrides,
});

// Stock 0 on purpose: a Pick has no PetPosture stock, so none of it may show on the page.
const product = (pick: ProductPick = pickData(), overrides: Partial<Product> = {}): Product & { pick: ProductPick } => ({
    id: 1,
    productId: 1,
    variantId: 10,
    slug: 'necoichi-bowl',
    name: 'Necoichi Raised Cat Food Bowl',
    category: 'Bowls',
    categorySlug: 'bowls',
    price: 22.71,
    rating: 4.6,
    reviews: 128,
    image: '/storage/bowl.png',
    images: [{ id: 1, src: '/storage/bowl.png', alt: 'Bowl from above' }],
    brand: 'Necoichi',
    description: '<p>A raised, tilted bowl.</p>',
    specs: [{ label: 'Material', value: 'Ceramic' }],
    available: false,
    stockStatus: 'out_of_stock',
    pick,
    ...overrides,
} as Product & { pick: ProductPick });

const related = (slug: string, name: string): Product => ({
    id: 2, productId: 2, variantId: 20, slug, name, category: 'Bowls', categorySlug: 'bowls',
    price: 10, rating: 0, reviews: 0, image: `/storage/${slug}.png`, pick: pickData({ goUrl: `https://api.petposture.com/go/pick/${slug}` }),
} as Product);

const render = (p = product(), others: Product[] = []) => renderToStaticMarkup(<PickDetails product={p} related={others} />);

describe('PickDetails', () => {
    it('has no cart, stock, shipping, returns or payment text, even when the variant stock is 0', () => {
        const html = render().toLowerCase();

        for (const banned of [
            'add to cart', 'add to bag', 'buy now', 'quantity', 'in stock', 'out of stock', 'out_of_stock',
            'shipping', 'returns', 'guarantee', 'free express', 'next-day', '30-day', 'checkout', 'payment',
        ]) {
            expect(html, banned).not.toContain(banned);
        }
    });

    it('does not link into the shop, the cart or the checkout', () => {
        const html = render(product(), [related('slo-bowl', 'Slo Bowl')]);

        expect(html).not.toMatch(/href="\/(shop|cart|checkout)/);
    });

    it('has exactly one primary button, opening the tracked link in a new tab with the affiliate rel', () => {
        const html = render();
        const anchors = html.match(/<a [^>]*rel="sponsored noopener"[^>]*>[\s\S]*?<\/a>/g) ?? [];

        expect(anchors).toHaveLength(1);
        expect(anchors[0]).toContain(`href="${GO_URL}"`);
        expect(anchors[0]).toContain('target="_blank"');
        // the logo beside it names the store, so the button only says Buy; a screen reader still hears which store
        expect(anchors[0]).toContain('aria-label="Buy on Chewy"');
        expect(anchors[0]).toContain('>Buy<');
        expect(html).not.toContain('noreferrer');
    });

    it('makes each Buy button 36px high with small text, not the taller sizes of the single buy box', () => {
        const html = render();
        const anchor = html.match(/<a [^>]*rel="sponsored noopener"[^>]*>/)?.[0] ?? '';

        expect(anchor).toContain('h-[36px]');
        expect(anchor).toContain('text-[0.78rem]');
        expect(anchor).not.toContain('min-h-[52px]');
        expect(anchor).not.toContain('h-14');
    });

    // The Muse mock ends the button with the diagonal "opens elsewhere" arrow (up and to the right), not a plain →.
    it('ends the button with the diagonal up-right arrow of the design, hidden from screen readers', () => {
        const html = render();
        const anchor = html.match(/<a [^>]*rel="sponsored noopener"[^>]*>[\s\S]*?<\/a>/)?.[0] ?? '';

        expect(anchor).toMatch(/>Buy<svg [^>]*aria-hidden="true"[^>]*><path d="M7 17L17 7M9 7h8v8"><\/path><\/svg><\/a>$/);
        expect(anchor).not.toContain('→');
    });

    it('keeps the Check Price wording when the retailer is Amazon, and shows its name instead of a logo', () => {
        const html = render(product(pickData({ retailer: 'amazon', retailerName: 'Amazon' })));

        expect(html).toContain('aria-label="Check Price on Amazon"');
        expect(html).toContain('>Check Price<');
        expect(html).not.toContain('/images/retailers/');
        expect(html).toContain('>Amazon</span>');
    });

    // A second store only has a row once its price and the date it was checked are both entered.
    const PETSMART = { retailer: 'petsmart', retailerName: 'PetSmart', goUrl: 'https://petposture.com/go/pick/necoichi-bowl?retailer=second', price: 40.99, priceCheckedDate: '2026-11-21' };
    const priced = (price: number | null, priceCheckedDate: string | null) => ({ ...PETSMART, price, priceCheckedDate });
    const anchors = (html: string) => [...html.matchAll(/<a [^>]*rel="sponsored noopener"[^>]*>[\s\S]*?<\/a>/g)].map((match) => match[0]);

    // The table says "recent" from today's date, so the date is fixed here (the page passes the real one).
    const today = (iso: string) => vi.useFakeTimers({ toFake: ['Date'], now: new Date(`${iso}T12:00:00Z`) });
    afterEach(() => vi.useRealTimers());

    const furhaven = (chewyPrice: number, chewyDate: string, petsmartPrice: number | null, petsmartDate: string | null) =>
        render(product(pickData({ referencePrice: chewyPrice, priceCheckedDate: chewyDate, secondRetailer: priced(petsmartPrice, petsmartDate) })));

    it('adds a PetSmart row right under the Chewy one, before the affiliate disclosure', () => {
        const html = render(product(pickData({ secondRetailer: PETSMART })));
        const [chewy, petsmart] = anchors(html);

        expect(anchors(html)).toHaveLength(2);
        expect(chewy).toContain('aria-label="Buy on Chewy"');
        expect(petsmart).toContain('aria-label="Buy on PetSmart"');
        expect(html.indexOf('aria-label="Buy on Chewy"')).toBeLessThan(html.indexOf('aria-label="Buy on PetSmart"'));
        expect(html.indexOf('aria-label="Buy on PetSmart"')).toBeLessThan(html.indexOf('PetPosture may earn a commission'));
        // it goes through /go like the first button, opens a new tab and carries the same rel
        expect(petsmart).toContain('href="https://petposture.com/go/pick/necoichi-bowl?retailer=second"');
        expect(petsmart).toContain('target="_blank"');
        expect(petsmart).toContain('rel="sponsored noopener"');
    });

    it('draws the PetSmart button as the outline button and the Chewy one as the solid orange one, the same size', () => {
        const [chewy, petsmart] = anchors(render(product(pickData({ secondRetailer: PETSMART }))));
        const classes = (anchor: string) => anchor.match(/class="([^"]*)"/)![1];

        expect(classes(petsmart)).toContain('border border-primary bg-white');
        expect(classes(petsmart)).not.toContain('bg-secondary');
        expect(classes(petsmart)).toContain('h-[36px]');
        expect(classes(petsmart)).toContain('uppercase');
        expect(classes(chewy)).toContain('bg-secondary');
        expect(classes(chewy)).toContain('h-[36px]');
    });

    it('shows one Chewy row, no PetSmart and no second link when there is no second retailer', () => {
        for (const secondRetailer of [undefined, null]) {
            const html = render(product(pickData({ secondRetailer })));

            expect(anchors(html)).toHaveLength(1);
            expect(html).not.toContain('PetSmart');
            expect(html).not.toContain('retailer=second');
            expect(html).not.toContain('Lower price');
            expect(html).not.toContain('FDF2EA');
        }
    });

    it('shows both prices, each with its own check date, the Chewy one first', () => {
        today('2026-11-21');
        const html = furhaven(64.99, '2026-11-17', 40.99, '2026-11-21');

        expect(html).toContain('>$64.99<');
        expect(html).toContain('17 Nov 2026');
        expect(html).toContain('>$40.99<');
        expect(html).toContain('21 Nov 2026');
        expect(html.indexOf('$64.99')).toBeLessThan(html.indexOf('$40.99'));
        expect(html).toContain('Compare prices');
    });

    it('marks the cheaper store with a peach block and a "Lower price" line under its row', () => {
        today('2026-11-21');
        const html = furhaven(64.99, '2026-11-17', 40.99, '2026-11-21');

        expect(html).toContain('Lower price · Save $24.00');
        expect(html.match(/Lower price/g)).toHaveLength(1);
        expect(html).toContain('bg-[#FDF2EA]');
        // the line hangs under the PetSmart price inside the row: the price comes first, then the line, then the Buy button
        expect(html.indexOf('>$40.99<')).toBeLessThan(html.indexOf('Lower price'));
        expect(html.indexOf('Lower price')).toBeLessThan(html.indexOf('aria-label="Buy on PetSmart"'));
        expect(html.indexOf('aria-label="Buy on PetSmart"')).toBeLessThan(html.indexOf('PetPosture may earn a commission'));
    });

    it('marks Chewy instead when Chewy is the cheaper one', () => {
        today('2026-11-21');
        const html = furhaven(20, '2026-11-20', 25.5, '2026-11-21');

        expect(html).toContain('Lower price · Save $5.50');
        // the line belongs to the Chewy row: after the Chewy price, before the Chewy button, and so before the PetSmart row
        expect(html.indexOf('>$20.00<')).toBeLessThan(html.indexOf('Lower price'));
        expect(html.indexOf('Lower price')).toBeLessThan(html.indexOf('aria-label="Buy on Chewy"'));
        expect(html.indexOf('aria-label="Buy on Chewy"')).toBeLessThan(html.indexOf('aria-label="Buy on PetSmart"'));
    });

    it('says nothing about a saving of a cent, of 99 cents, or of nothing at all, and tints no row', () => {
        today('2026-11-21');

        for (const [chewy, petsmart] of [[18.4, 18.39], [19.43, 19.43], [29.99, 29.0]] as const) {
            const html = furhaven(chewy, '2026-11-21', petsmart, '2026-11-21');

            expect(html, `${chewy} vs ${petsmart}`).not.toContain('Lower price');
            expect(html, `${chewy} vs ${petsmart}`).not.toContain('FDF2EA');
            expect(html).toContain(`>$${petsmart.toFixed(2)}<`);
        }
    });

    it('does say it from exactly one dollar', () => {
        today('2026-11-21');

        expect(furhaven(30, '2026-11-21', 29, '2026-11-21')).toContain('Lower price · Save $1.00');
    });

    it('keeps both prices but drops the line when either check is more than 30 days old', () => {
        today('2026-11-21');

        for (const html of [furhaven(64.99, '2026-10-01', 40.99, '2026-11-21'), furhaven(64.99, '2026-11-21', 40.99, '2026-10-01')]) {
            expect(html).toContain('>$64.99<');
            expect(html).toContain('>$40.99<');
            expect(html).not.toContain('Lower price');
            expect(html).not.toContain('FDF2EA');
        }
        // 30 days old is still recent
        expect(furhaven(64.99, '2026-10-22', 40.99, '2026-11-21')).toContain('Lower price');
    });

    it('leaves the PetSmart row out altogether, button included, until its price and date are both entered', () => {
        today('2026-11-21');

        for (const [price, date] of [[null, null], [40.99, null], [null, '2026-11-21']] as const) {
            const html = furhaven(64.99, '2026-11-17', price, date);

            expect(anchors(html), `${price} ${date}`).toHaveLength(1);
            expect(html).not.toContain('PetSmart');
            expect(html).not.toContain('retailer=second');
            expect(html).not.toContain('40.99');
            expect(html).not.toContain('Lower price');
            expect(html).not.toContain('FDF2EA');
            // one store again, so the one-link wording and a single Chewy row
            expect(html).toContain('if you buy through this link,');
        }
    });

    it('has no PetSmart price while the Chewy price has no date, and no comparison', () => {
        today('2026-11-21');
        const html = render(product(pickData({ referencePrice: null, priceCheckedDate: null, secondRetailer: priced(40.99, '2026-11-21') })));

        expect(html).not.toContain('Lower price');
        expect(html).not.toContain('64.99');
        expect(html).toContain('>$40.99<');
    });

    it('does not compare prices once the reader can choose between variants, and gives PetSmart no price then', () => {
        today('2026-11-21');
        const variants = [
            { id: 1, label: 'Mist Gray', options: [{ name: 'Colour', value: 'Mist Gray' }], referencePrice: 64.99, goUrl: `${GO_URL}?variant=1` },
            { id: 2, label: 'Black', options: [{ name: 'Colour', value: 'Black' }], referencePrice: 64.99, goUrl: `${GO_URL}?variant=2` },
        ];
        const html = render(product(pickData({ referencePrice: 64.99, priceCheckedDate: '2026-11-17', variants, secondRetailer: priced(40.99, '2026-11-21') })));

        expect(html).toContain('>$64.99<');
        expect(html).not.toContain('40.99');
        expect(html).not.toContain('Lower price');
        expect(html).toContain('aria-label="Buy on PetSmart"');

        // with the chooser too, a PetSmart row needs its price and date entered before it appears at all
        const unpriced = render(product(pickData({ referencePrice: 64.99, priceCheckedDate: '2026-11-17', variants, secondRetailer: priced(null, null) })));
        expect(unpriced).not.toContain('PetSmart');
        expect(anchors(unpriced)).toHaveLength(1);
    });

    it('lines the columns up: one shared grid with a fixed 104px Buy column, and the header and every row, the tinted one included, are subgrids of it', () => {
        today('2026-11-21');
        const html = furhaven(64.99, '2026-11-17', 40.99, '2026-11-21');

        expect(html).toContain('grid-cols-[minmax(0,1.05fr)_minmax(0,0.72fr)_minmax(0,1.05fr)_104px]');
        expect(html).not.toContain('auto_minmax');
        // the header and both rows and the tinted block span all the columns of the table
        const rows = html.match(/role="row" class="[^"]*"/g) ?? [];
        expect(rows).toHaveLength(3);
        for (const row of rows) {
            expect(row).toContain('grid-cols-subgrid');
            expect(row).toContain('col-span-full');
        }
        // the tinted row is one of those subgrid rows itself, not a block around it
        expect(html).toMatch(/role="row" class="col-span-full grid grid-cols-subgrid [^"]*bg-\[#FDF2EA\][^"]*"/);
        // four cells in a row, so a missing price leaves its column empty instead of moving the button
        expect(html.match(/role="cell"/g)).toHaveLength(8);
    });

    // The rows of the table, header first, as the pieces of HTML each starts at.
    const rowsOf = (html: string) => html.split('<div role="row"').slice(1);
    const classes = (element: string) => element.match(/class="([^"]*)"/)?.[1] ?? '';

    it('draws the tinted row with square corners, flush with the table', () => {
        today('2026-11-21');
        const tinted = rowsOf(furhaven(64.99, '2026-11-17', 40.99, '2026-11-21')).find((row) => row.includes('bg-[#FDF2EA]')) ?? '';

        expect(classes(tinted)).toContain('bg-[#FDF2EA]');
        expect(classes(tinted)).not.toContain('rounded');
    });

    it('leaves a 6px gap above the tinted row, and none above the other rows', () => {
        today('2026-11-21');
        const [header, chewy, petsmart] = rowsOf(furhaven(64.99, '2026-11-17', 40.99, '2026-11-21'));

        expect(classes(petsmart)).toContain('mt-[6px]');
        expect(classes(chewy)).not.toContain('mt-[');
        expect(classes(header)).not.toContain('mt-[');
    });

    it('shows the "Lower price" line as plain green text inside the Price cell, not as a pill and not as a line of its own', () => {
        today('2026-11-21');
        const html = furhaven(64.99, '2026-11-17', 40.99, '2026-11-21');
        const tinted = rowsOf(html).find((row) => row.includes('bg-[#FDF2EA]')) ?? '';
        const [, priceCell] = tinted.split('role="cell"').slice(1);
        const line = priceCell.match(/<span class="([^"]*)">Lower price · Save \$24\.00<\/span>/)?.[1] ?? '';

        // the second cell is the Price one: it holds the price and the line together
        expect(priceCell).toContain('>$40.99<');
        expect(line).toContain('text-[#2e7d4f]');
        expect(line).toContain('font-bold');
        for (const pill of ['rounded', 'bg-[#e7f3ec]', 'bg-green', 'px-[9px]', 'uppercase', 'inline-block']) {
            expect(line, pill).not.toContain(pill);
        }
        // the old full-width line under the row is gone
        expect(html).not.toContain('col-span-full px-[2px] pb-[14px]');
        expect(tinted.match(/role="cell"/g)).toHaveLength(4);
    });

    it('hangs the line under the price without moving the row: out of the flow on desktop, the row holds it with extra bottom padding', () => {
        today('2026-11-21');
        const [, chewy, petsmart] = rowsOf(furhaven(64.99, '2026-11-17', 40.99, '2026-11-21'));
        const line = classes(petsmart.match(/<span class="[^"]*">Lower price/)?.[0] ?? '');

        // absolute and 6px under the price: it takes no part in centring the price, the date, the logo and the button
        expect(line).toContain('absolute');
        expect(line).toContain('top-[calc(100%+6px)]');
        expect(line).toContain('left-0');
        expect(line).toContain('whitespace-nowrap');
        // the date is on the main line: no row of its own except on a phone
        const dateCell = classes(petsmart.split('role="cell"')[3]);
        expect(dateCell.split(' ').filter((token) => /^row-start-/.test(token))).toEqual([]);
        // 30px under the tinted row (14px on a phone, where the line is in the flow), 14px under the others
        expect(classes(petsmart)).toContain('pb-[30px]');
        expect(classes(petsmart)).toContain('max-[560px]:pb-[14px]');
        expect(classes(chewy)).toContain('pb-[14px]');
        expect(classes(chewy)).not.toContain('pb-[30px]');
    });

    it('insets the logo and the Buy button 12px, and the header Merchant label with the logo, on every row', () => {
        today('2026-11-21');
        const html = furhaven(64.99, '2026-11-17', 40.99, '2026-11-21');
        const [header, ...rows] = rowsOf(html);

        expect(header).toContain('<span role="columnheader" class="pl-[12px]">Merchant</span>');
        for (const row of rows) {
            expect(classes(row.split('role="cell"')[1])).toContain('pl-[12px]');
            const button = classes(row.match(/<a [^>]*>/)?.[0] ?? '');
            expect(button).toContain('w-[calc(100%-12px)]');
            expect(button).toContain('max-[560px]:mr-[12px]');
            expect(button).toContain('max-[560px]:w-auto');
        }
    });

    it('keeps the logo from being squeezed out of shape when its column is narrow', () => {
        const html = render(product(pickData({ secondRetailer: PETSMART })));

        expect(html.match(/<img [^>]*object-contain object-left[^>]*>/g)).toHaveLength(2);
    });

    it('stacks a row on a phone: header hidden, logo, price and button on the first line, the check date under them', () => {
        today('2026-11-21');
        const html = furhaven(64.99, '2026-11-17', 40.99, '2026-11-21');

        expect(html).toContain('max-[560px]:hidden');
        expect(html).toContain('max-[560px]:grid-cols-[minmax(0,1fr)_auto_auto]');
        expect(html).toContain('max-[560px]:row-start-2');
        expect(html).toContain('max-[560px]:min-w-[72px]');
        expect(html).toContain('>Checked </span>17 Nov 2026');
    });

    it('on a phone puts the saving on the second line, right-aligned under the price and the button, the date on the left', () => {
        today('2026-11-21');
        const [, chewy, petsmart] = rowsOf(furhaven(64.99, '2026-11-17', 40.99, '2026-11-21'));
        const cells = petsmart.split('role="cell"');
        const priceCell = classes(cells[2]);
        const date = classes(cells[3]);
        const line = classes(petsmart.match(/<span class="[^"]*">Lower price/)?.[0] ?? '');

        // the Price cell draws nothing itself on a phone, so the price and the line sit in the grid of the row
        expect(priceCell).toContain('max-[560px]:contents');
        // second line: the saving over the two right columns (under the price and the button), pulled in to the button's edge
        for (const token of ['max-[560px]:static', 'max-[560px]:col-start-2', 'max-[560px]:col-span-2', 'max-[560px]:row-start-2', 'max-[560px]:justify-self-end', 'max-[560px]:mr-[12px]']) {
            expect(line, token).toContain(token);
        }
        // the date takes the first column of that line only, so the saving has the room; inset 12px to stand under the logo
        expect(date).toContain('max-[560px]:col-span-1');
        expect(date).toContain('max-[560px]:col-start-1');
        expect(date).toContain('max-[560px]:row-start-2');
        expect(date).toContain('max-[560px]:pl-[12px]');
        // a row without a saving keeps the date over the whole line, inset the same
        const plainDate = classes(chewy.split('role="cell"')[3]);
        expect(plainDate).toContain('max-[560px]:col-span-3');
        expect(plainDate).toContain('max-[560px]:pl-[12px]');
    });

    it('draws each store as a logo with its name as the alt text, and names a store that has no logo in text', () => {
        const html = render(product(pickData({ secondRetailer: PETSMART })));

        expect(html).toContain('<img src="/images/retailers/chewy.png" alt="Chewy"');
        expect(html).toContain('<img src="/images/retailers/petsmart.png" alt="PetSmart"');
        expect(html).toContain('h-[18px]');
        expect(html).toContain('min-[561px]:h-[22px]');
        expect(render(product(pickData({ retailer: 'zooplus', retailerName: 'Zooplus' })))).toContain('>Zooplus</span>');
    });

    it('says which product the prices are for, from the colour and size of the quick specs', () => {
        const line = (quickSpecs: { label: string; value: string }[]) => render(product(pickData({ quickSpecs })));

        expect(line([{ label: 'Color', value: 'Mist Gray' }, { label: 'Size', value: 'Large' }])).toContain('Mist Gray · Large');
        expect(line([{ label: 'Colour', value: 'Black' }, { label: 'Size', value: 'Medium: 24 to 34-in chest' }])).toContain('Black · Medium<');
        expect(line([{ label: 'Size', value: 'Medium — 3.5 in wide x 3 in high' }])).toContain('>Medium<');
        expect(line([{ label: 'Material', value: 'Porcelain' }])).not.toMatch(/mt-1 text-\[0\.85rem\]/);
    });

    it('says "this link" with one store and "these links" with two', () => {
        expect(render()).toContain('if you buy through this link,');
        expect(render(product(pickData({ secondRetailer: PETSMART })))).toContain('if you buy through these links,');
    });

    it('keeps the buy box right after the title in the page source, before "Our take" and the photo', () => {
        const html = render();
        const title = html.indexOf('<h1');
        const button = html.indexOf('aria-label="Buy on Chewy"');

        expect(title).toBeGreaterThan(-1);
        expect(button).toBeGreaterThan(title);
        expect(button).toBeLessThan(html.indexOf('Our take'));
        // the Chewy logo inside the buy box is an image too, so the photo is found by its own alt text
        expect(html.indexOf('alt="Bowl from above"')).toBeGreaterThan(-1);
        expect(button).toBeLessThan(html.indexOf('alt="Bowl from above"'));
    });

    it('draws the photo right under the title on a phone and leaves the two desktop columns as they were', () => {
        const html = render();
        const header = html.match(/<header class="([^"]*)"/)?.[1] ?? '';
        const gallery = html.match(/<div class="([^"]*lg:col-start-1[^"]*)"/)?.[1] ?? '';

        // title first, photo second, everything else in its written order (order 0)
        expect(header).toContain('order-[-2]');
        expect(gallery).toContain('order-[-1]');
        // from lg up `order` is reset and the explicit columns apply: photo left, information right
        expect(header).toContain('lg:order-none');
        expect(header).toContain('lg:col-start-2');
        expect(gallery).toContain('lg:order-none');
        expect(gallery).toContain('lg:row-span-2');
    });

    it('keeps the hero to the photo, the title and the buy box, and runs the rest full width in the written order', () => {
        const html = render();
        const order = ['Our take', 'Best for', 'Product details', 'Quick Specs', 'The practical difference', 'Honest Pros', 'More PetPosture Picks'].map((text) => html.indexOf(text));

        expect(order.every((position) => position > -1)).toBe(true);
        expect(order).toEqual([...order].sort((a, b) => a - b));
        // the buy box is above all of them
        expect(html.indexOf('aria-label="Buy on Chewy"')).toBeGreaterThan(-1);
        expect(html.indexOf('aria-label="Buy on Chewy"')).toBeLessThan(order[0]);
    });

    it('shows the price as the retailer price with the date it was checked, never the site price', () => {
        const html = render();

        expect(html).toContain('Compare prices');
        expect(html).toContain('>$49.96<');
        expect(html).toContain('14 Nov 2026');
        expect(html).not.toContain('22.71');
        // the old single-store card is gone
        expect(html).not.toContain('Price at Chewy');
        expect(html).not.toContain('check current price');
    });

    it('shows no price at all without a checked date', () => {
        const html = render(product(pickData({ priceCheckedDate: null, referencePrice: null })));

        expect(html).not.toContain('$');
        expect(html).not.toContain('49.96');
        expect(html).not.toContain('22.71');
        expect(html).not.toContain('Checked');
    });

    it('puts the live affiliate disclosure right after the price table', () => {
        const html = render();
        const disclosure = 'PetPosture may earn a commission if you buy through this link, at no extra cost to you.';
        const buttonEnd = html.indexOf('</a>', html.indexOf('aria-label="Buy on Chewy"'));

        expect(html).toContain(disclosure);
        expect(html.indexOf(disclosure) - buttonEnd).toBeGreaterThan(0);
        expect(html.indexOf(disclosure) - buttonEnd).toBeLessThan(200);
    });

    it('names the date in the eyebrow when there is one, and only "PetPosture Pick" when there is not', () => {
        expect(render()).toContain('PetPosture Pick · Checked 14 Nov 2026');
        expect(render(product(pickData({ priceCheckedDate: null, referencePrice: null })))).toContain('PetPosture Pick');
    });

    it('does not present the site rating or review count as a retailer rating', () => {
        const html = render();

        expect(html).not.toContain('4.6');
        expect(html).not.toContain('128');
        expect(html.toLowerCase()).not.toContain('verified');
        expect(html).not.toContain('AggregateRating');
    });

    it('never says the products were researched or tested by PetPosture', () => {
        const withoutTake = render(product(pickData({ ourTake: null }))).toLowerCase();

        expect(withoutTake).not.toContain('researched');
        expect(withoutTake).not.toContain('tested');
        expect(withoutTake).not.toContain('we checked');
    });

    it('shows "Our take" exactly as entered, and leaves the block out when it is empty', () => {
        expect(render()).toContain('Our take');
        expect(render()).toContain(OUR_TAKE.replace(/'/g, '&#x27;'));
        expect(render(product(pickData({ ourTake: null })))).not.toContain('Our take');
    });

    it('lists the quick specs, lets them win over the same label from the product specs, and hides the card when there are none', () => {
        const html = render();

        expect(html).toContain('Quick Specs');
        expect(html).toContain('Porcelain');
        expect(html).toContain('15°');
        expect(html).not.toContain('Ceramic');
        expect(render(product(pickData({ quickSpecs: [] }), { specs: [] }))).not.toContain('Quick Specs');
    });

    it('keeps product specs entered the old way when no quick spec uses their label', () => {
        const html = render(product(pickData({ quickSpecs: [] })));

        expect(html).toContain('Quick Specs');
        expect(html).toContain('Ceramic');
    });

    it('links each best-for breed to its guide and lists the free-text notes beside them', () => {
        const html = render();

        expect(html).toContain('href="/dogs/french-bulldog"');
        expect(html).toContain('French Bulldog');
        expect(html).toContain('href="/dogs/pug"');
        expect(html).toContain('Small, split meals');
    });

    it('shows the problem and the approach as two cards, each only when entered', () => {
        const both = render();
        expect(both).toContain('The practical difference');
        expect(both).toContain('The Problem');
        expect(both).toContain('A flat bowl makes a flat-faced dog bend its neck.');
        expect(both).toContain('The PetPosture Approach');

        const onlyProblem = render(product(pickData({ approach: null })));
        expect(onlyProblem).toContain('The Problem');
        expect(onlyProblem).not.toContain('The PetPosture Approach');

        expect(render(product(pickData({ problem: null, approach: null })))).not.toContain('The practical difference');
    });

    it('lists the pros under "What we like" and the cons under "What to know first"', () => {
        const html = render();

        expect(html).toContain('Honest Pros &amp; Cons');
        expect(html).toContain('What we like');
        expect(html).toContain('Raised design');
        expect(html).toContain('Easy to clean');
        expect(html).toContain('What to know first');
        expect(html).toContain('Holds about one cup');
    });

    it('leaves out the cons card when there are no cons, and the whole section when there is nothing to list', () => {
        const noCons = render(product(pickData({ cons: [] })));
        expect(noCons).toContain('What we like');
        expect(noCons).not.toContain('What to know first');

        expect(render(product(pickData({ pros: [], cons: [] })))).not.toContain('Honest Pros');
    });

    it('shows the description entered in the admin, unchanged, in its own "Product details" block before the Quick Specs', () => {
        const html = render();

        expect(html).toContain('A raised, tilted bowl.');
        expect(html.indexOf('Product details')).toBeGreaterThan(-1);
        expect(html.indexOf('Product details')).toBeLessThan(html.indexOf('A raised, tilted bowl.'));
        expect(html.indexOf('A raised, tilted bowl.')).toBeLessThan(html.indexOf('Quick Specs'));
        // a paragraph, not a list of bullets
        expect(html.slice(html.indexOf('Product details'), html.indexOf('Quick Specs'))).not.toMatch(/<li[\s>]/);
    });

    // The class list of the one box that holds Product details and Quick Specs (the hero has a grid of its own).
    const detailsBox = (html: string) => html.match(/class="([^"]*rounded-2xl[^"]*empty:hidden[^"]*)"/)?.[1] ?? '';

    it('puts the two columns side by side from lg up, and one above the other below that, inside one box', () => {
        const box = detailsBox(render());

        expect(box).toContain('rounded-2xl');
        expect(box).toContain('border');
        expect(box).toContain('grid-cols-1');
        expect(box).toContain('lg:grid-cols-2');
        expect(box).toContain('items-start');
        // only a gap between the columns, no divider line
        expect(box).not.toMatch(/divide-|border-l|border-r/);
    });

    it('is one box: Product details and Quick Specs sit in the same card, with no second card between them', () => {
        const html = render();
        const between = html.slice(html.indexOf('Product details'), html.indexOf('Quick Specs'));

        expect(between).not.toContain('rounded-2xl');
        expect(html.match(/class="[^"]*empty:hidden[^"]*"/g)).toHaveLength(1);
    });

    it('draws nothing for a description that is only empty tags, so no gap is left, and Quick Specs takes the whole width', () => {
        for (const description of ['<p></p>', '']) {
            const html = render(product(pickData(), { description }));

            expect(html).not.toContain('Product details');
            expect(html).not.toContain('<p></p>');
            expect(html).toContain('Quick Specs');
            expect(detailsBox(html)).not.toContain('lg:grid-cols-2');
            // alone, the specs run in two columns
            expect(html).toContain('md:columns-2');
        }
    });

    it('shows Product details alone, across the whole width, when there are no specs', () => {
        const html = render(product(pickData({ quickSpecs: [] }), { specs: [] }));

        expect(html).toContain('Product details');
        expect(html).toContain('A raised, tilted bowl.');
        expect(html).not.toContain('Quick Specs');
        expect(detailsBox(html)).not.toContain('lg:grid-cols-2');
    });

    // Below lg each of the two is an accordion, closed to start with; from lg up they are plain blocks that are always shown.
    const accordion = (html: string, title: string) => html.match(new RegExp(`<button[^>]*aria-expanded="(true|false)"[^>]*><span class="[^"]*">${title}</span>`))?.[1];

    it('starts both as closed accordions on a phone, each with its own button and a plus', () => {
        const html = render();

        expect(accordion(html, 'Product details')).toBe('false');
        expect(accordion(html, 'Quick Specs')).toBe('false');
        expect(html.match(/<span aria-hidden="true"[^>]*>\+<\/span>/g)).toHaveLength(2);
        // the content of both is hidden below lg and forced visible from lg up
        expect(html.match(/class="hidden lg:block lg:pb-0"/g)).toHaveLength(2);
    });

    it('keeps the plain titles for lg and up, where there is no accordion', () => {
        const html = render();

        expect(html).toMatch(/<h3 class="mb-3 hidden lg:block [^"]*">Product details<\/h3>/);
        expect(html).toMatch(/<h3 class="mb-3 hidden lg:block [^"]*">Quick Specs<\/h3>/);
    });

    it('has an accordion only for what is there: no description, no Product details; no specs, no Quick Specs', () => {
        const noDescription = render(product(pickData(), { description: '<p></p>' }));
        const noSpecs = render(product(pickData({ quickSpecs: [] }), { specs: [] }));

        expect(accordion(noDescription, 'Product details')).toBeUndefined();
        expect(accordion(noDescription, 'Quick Specs')).toBe('false');
        expect(accordion(noSpecs, 'Product details')).toBe('false');
        expect(accordion(noSpecs, 'Quick Specs')).toBeUndefined();
    });

    it('centers the titles of The practical difference and Honest Pros & Cons, the same way as More PetPosture Picks', () => {
        const html = render();

        for (const text of ['The practical difference', 'Honest Pros &amp; Cons', 'More PetPosture Picks']) {
            const match = html.match(new RegExp(`<div class="([^"]*)"><h2[^>]*>${text}</h2><div class="([^"]*)"></div></div>`));

            expect(match, text).not.toBeNull();
            // the text is centered, and so is the orange bar under it, at every width
            expect(match![1]).toContain('text-center');
            expect(match![1]).not.toMatch(/\blg:text-left\b|\bmd:text-left\b|\btext-left\b/);
            expect(match![2]).toContain('mx-auto');
        }
    });

    it('draws no box at all when there is neither a description nor any specs, so no gap is left', () => {
        const html = render(product(pickData({ quickSpecs: [] }), { specs: [], description: '<p></p>' }));

        expect(html).not.toContain('Product details');
        expect(html).not.toContain('Quick Specs');
        expect(html.match(/class="[^"]*empty:hidden[^"]*"/g) ?? []).toHaveLength(1);
        // the box has no children, so `empty:hidden` takes it out of the layout
        expect(html).toMatch(/<div class="[^"]*empty:hidden[^"]*"><\/div>/);
    });

    it('keeps the specs in one column when they sit beside the description', () => {
        expect(render()).not.toContain('md:columns-2');
    });

    it('has a breadcrumb Home > Picks > the Pick, with Picks linking to the list', () => {
        const html = render();

        expect(html).toContain('aria-label="Breadcrumb"');
        expect(html).toContain('href="/picks"');
        expect(html).not.toMatch(/Feeding/);
    });

    // As in the design: a full-width grey bar right under the menu. Home is grey, Picks (the list) is bold and links
    // to it, and the Pick being viewed ends the trail as plain text.
    it('puts the breadcrumb in a full-width grey bar, Picks in bold and the Pick as plain text', () => {
        const p = product();
        const html = render(p);
        const nav = html.match(/<nav aria-label="Breadcrumb"[^>]*>/)?.[0] ?? '';
        const home = html.match(/<a [^>]*href="\/"[^>]*>[\s\S]*?<\/a>/)?.[0] ?? '';
        const picks = html.match(/<a [^>]*href="\/picks"[^>]*>[\s\S]*?<\/a>/)?.[0] ?? '';

        expect(nav).toContain('bg-[#f4f5f6]');
        expect(nav).toContain('border-b');
        expect(html.indexOf('<nav aria-label="Breadcrumb"')).toBeLessThan(html.indexOf('<h1'));
        expect(home).toContain('text-[#6b7680]');
        expect(home).toContain('>Home<');
        expect(picks).toContain('font-bold');
        expect(picks).toContain('>Picks<');
        expect(html).toMatch(new RegExp(`aria-current="page"[^>]*>${p.name}</`));
        expect(html).not.toMatch(/aria-current="page"[^>]*font-bold/);
    });

    it('leaves room between the breadcrumb bar and the content under it', () => {
        const section = render().match(/<\/nav><section[^>]*>/)?.[0] ?? '';

        expect(section).toMatch(/class="[^"]*\bpt-6\b/);
    });

    it('separates the breadcrumb steps with › text, not icons', () => {
        const nav = render().match(/<nav aria-label="Breadcrumb"[\s\S]*?<\/nav>/)?.[0] ?? '';

        expect(nav.match(/›/g)).toHaveLength(2);
        expect(nav).not.toContain('<svg');
    });

    it('renders no image, not a broken one, when the Pick has no photo yet', () => {
        const withoutPhoto = product(pickData(), { image: null, images: [] } as unknown as Partial<Product>);
        const html = render(withoutPhoto);

        // no product photo; the only image left is the Chewy logo in the price table
        expect(html).not.toContain('/storage/bowl.png');
        expect(html.match(/<img /g)).toHaveLength(1);
        expect(html).not.toContain('src=""');
        expect(html).toContain('aria-label="Buy on Chewy"');
    });

    it('shows every related Pick as a card with its photo and name, not only the "All … Picks" link', () => {
        const html = render(product(), [related('slo-bowl', 'Slo Bowl'), related('puppia-vest', 'Puppia Vest'), related('ramp', 'Dog Ramp')]);

        for (const name of ['Slo Bowl', 'Puppia Vest', 'Dog Ramp']) {
            expect(html, name).toContain(`alt="${name}"`);
            expect(html, name).toContain(`>${name}<`);
        }
        expect(html.match(/View pick/g)).toHaveLength(3);
    });

    it('links related Picks to their own pages, not to the shop', () => {
        const html = render(product(), [related('slo-bowl', 'Slo Bowl'), related('puppia-vest', 'Puppia Vest')]);

        expect(html).toContain('More PetPosture Picks');
        expect(html).toContain('href="/picks/slo-bowl"');
        expect(html).toContain('href="/picks/puppia-vest"');
    });

    // With no related Pick the text card is the fallback of the section: the only thing in its grid.
    it('offers all the Picks for the first breed as a fallback card when there is no related Pick', () => {
        const html = render();

        expect(html).toContain('All French Bulldog Picks');
        expect(html).toContain('href="/picks?breed=french-bulldog"');
        expect(html).toContain('Explore all');
        expect(html).not.toContain('See all');
    });

    // With related Picks the text card would sit alone on a second row of the grid, so it leaves the grid and
    // becomes a centred link under it.
    it('keeps the "All … Picks" card out of the grid once there are related Picks', () => {
        const html = render(product(), [related('slo-bowl', 'Slo Bowl'), related('puppia-vest', 'Puppia Vest'), related('ramp', 'Dog Ramp')]);
        const grid = html.match(/<ul class="grid[\s\S]*?<\/ul>/)?.[0] ?? '';

        expect(grid.match(/<li>/g)).toHaveLength(3);
        expect(grid).not.toContain('All French Bulldog Picks');
        expect(grid).not.toContain('Explore all');
        expect(html).not.toContain('Explore all');
        expect(html).not.toContain('All French Bulldog Picks');
    });

    it('adds a centred "See all … Picks →" link under the grid, to the list filtered by the first breed', () => {
        const html = render(product(), [related('slo-bowl', 'Slo Bowl'), related('puppia-vest', 'Puppia Vest'), related('ramp', 'Dog Ramp')]);

        expect(html).toMatch(
            /<\/ul><p[^>]*text-center[^>]*><a [^>]*href="\/picks\?breed=french-bulldog"[^>]*>See all French Bulldog Picks\s*<span aria-hidden="true">→<\/span><\/a><\/p>/,
        );
    });

    it('links to the whole list when the Pick has related Picks but no breed to filter by', () => {
        const html = render(product(pickData({ bestForBreeds: [] })), [related('slo-bowl', 'Slo Bowl')]);

        expect(html).toMatch(/<\/ul><p[^>]*text-center[^>]*><a [^>]*href="\/picks"[^>]*>See all Picks\s*<span aria-hidden="true">→<\/span>/);
        expect(html).not.toContain('All French Bulldog Picks');
    });

    it('has no "more picks" section when there are no other Picks and no breed to filter by', () => {
        const html = render(product(pickData({ bestForBreeds: [] }))).toLowerCase();

        expect(html).not.toContain('more petposture picks');
    });
});
