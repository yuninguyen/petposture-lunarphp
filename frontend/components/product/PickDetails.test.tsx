// @vitest-environment jsdom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
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
        expect(anchors[0]).toContain('>Buy on Chewy<');
        expect(html).not.toContain('noreferrer');
    });

    // The Muse mock's button is 52px high with 14px text; the 56px "lg" size read as too tall next to it.
    it('makes the button 52px high with 14px text like the design, not the taller lg size', () => {
        const html = render();
        const anchor = html.match(/<a [^>]*rel="sponsored noopener"[^>]*>/)?.[0] ?? '';

        expect(anchor).toContain('min-h-[52px]');
        expect(anchor).toContain('text-sm');
        expect(anchor).not.toContain('h-14');
    });

    // The Muse mock ends the button with the diagonal "opens elsewhere" arrow (up and to the right), not a plain →.
    it('ends the button with the diagonal up-right arrow of the design, hidden from screen readers', () => {
        const html = render();
        const anchor = html.match(/<a [^>]*rel="sponsored noopener"[^>]*>[\s\S]*?<\/a>/)?.[0] ?? '';

        expect(anchor).toMatch(/>Buy on Chewy<svg [^>]*aria-hidden="true"[^>]*><path d="M7 17L17 7M9 7h8v8"><\/path><\/svg><\/a>$/);
        expect(anchor).not.toContain('→');
    });

    it('names Amazon on the button when the retailer is Amazon', () => {
        const html = render(product(pickData({ retailer: 'amazon', retailerName: 'Amazon' })));

        expect(html).toContain('>Check Price on Amazon<');
    });

    it('keeps the buy box right after the title in the page source, before "Our take" and the photo', () => {
        const html = render();
        const title = html.indexOf('<h1');
        const button = html.indexOf('>Buy on Chewy<');

        expect(title).toBeGreaterThan(-1);
        expect(button).toBeGreaterThan(title);
        expect(button).toBeLessThan(html.indexOf('Our take'));
        expect(button).toBeLessThan(html.indexOf('<img'));
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
        expect(html.indexOf('>Buy on Chewy<')).toBeLessThan(order[0]);
    });

    it('shows the price as the retailer price with the date it was checked, never the site price', () => {
        const html = render();

        expect(html).toContain('Price at Chewy');
        expect(html).toContain('$49.96');
        expect(html).toContain('Checked 14 Nov 2026 — check current price');
        expect(html).not.toContain('22.71');
    });

    it('shows no price at all without a checked date', () => {
        const html = render(product(pickData({ priceCheckedDate: null, referencePrice: null })));

        expect(html).not.toContain('$');
        expect(html).not.toContain('49.96');
        expect(html).not.toContain('22.71');
        expect(html).not.toContain('Checked');
    });

    it('puts the live affiliate disclosure right after the button', () => {
        const html = render();
        const disclosure = 'PetPosture may earn a commission if you buy through this link, at no extra cost to you.';
        const button = html.indexOf('>Buy on Chewy<');

        expect(html).toContain(disclosure);
        expect(html.indexOf(disclosure) - button).toBeGreaterThan(0);
        expect(html.indexOf(disclosure) - button).toBeLessThan(400);
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

        expect(html).not.toContain('<img');
        expect(html).not.toContain('src=""');
        expect(html).toContain('>Buy on Chewy<');
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
