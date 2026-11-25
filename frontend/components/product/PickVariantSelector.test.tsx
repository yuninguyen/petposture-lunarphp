// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import type { PickVariant, ProductPick } from '@/types/shop';
import { PickBuyBox, PickSpecs, PickVariantProvider } from './PickVariantSelector';

const pick: ProductPick = {
    retailer: 'chewy', retailerName: 'Chewy', goUrl: 'https://petposture.com/go/pick/balance-harness', referencePrice: 45.95, priceCheckedDate: '2026-11-17',
    bestForBreeds: [], bestForNotes: [], ourTake: null, problem: null, approach: null, quickSpecs: [{ label: 'Colour', value: 'Camo (old)' }, { label: 'Material', value: 'Nylon' }], pros: [], cons: [],
};

const camo: PickVariant = { id: 1, label: 'Camo', options: [{ name: 'Colour', value: 'Camo' }], referencePrice: 45.95, goUrl: 'https://petposture.com/go/pick/balance-harness?variant=1' };
const black: PickVariant = { id: 2, label: 'Black', options: [{ name: 'Colour', value: 'Black' }], referencePrice: 49.95, goUrl: 'https://petposture.com/go/pick/balance-harness?variant=2' };

function page(variants?: PickVariant[]) {
    return (
        <PickVariantProvider variants={variants}>
            <PickBuyBox pick={pick} />
            <PickSpecs specs={pick.quickSpecs} className="specs" />
        </PickVariantProvider>
    );
}

describe('Pick variant selector', () => {
    afterEach(() => { document.body.innerHTML = ''; });

    it('shows no selector with no variants listed and keeps the product price and link', () => {
        for (const variants of [undefined, []]) {
            const html = renderToStaticMarkup(page(variants));

            expect(html).not.toContain('<fieldset');
            expect(html).toContain('href="https://petposture.com/go/pick/balance-harness"');
            expect(html).toContain('$45.95');
        }
    });

    it('shows no selector for a single listed variant', () => {
        expect(renderToStaticMarkup(page([camo]))).not.toContain('<fieldset');
    });

    it('with two variants offers both, starting on the first', () => {
        const html = renderToStaticMarkup(page([camo, black]));

        expect(html).toContain('<fieldset');
        expect(html).toContain('Colour');
        expect(html).toContain('Camo');
        expect(html).toContain('Black');
        expect(html).toContain('href="https://petposture.com/go/pick/balance-harness?variant=1"');
        expect(html).toContain('$45.95');
    });

    it('choosing a variant changes the price, the Buy link and the quick specs, and lists the product spec only once', async () => {
        (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        await act(async () => root.render(page([camo, black])));

        const chip = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Black')!;
        expect(chip.getAttribute('aria-pressed')).toBe('false');
        await act(async () => chip.click());

        expect(chip.getAttribute('aria-pressed')).toBe('true');
        expect(container.textContent).toContain('$49.95');
        expect(container.textContent).not.toContain('$45.95');
        expect(container.querySelector('a')!.getAttribute('href')).toBe('https://petposture.com/go/pick/balance-harness?variant=2');
        expect(container.querySelector('a')!.getAttribute('rel')).toBe('sponsored noopener');
        const specs = container.querySelector('.specs')!.textContent!;
        expect(specs).toContain('Black');
        expect(specs).not.toContain('Camo (old)');
        expect(specs.match(/Colour/g)).toHaveLength(1);
        expect(specs).toContain('Nylon');

        await act(async () => root.unmount());
    });

    it('shows no price for a variant when the price has no checked date, but still offers the link', () => {
        const html = renderToStaticMarkup(
            <PickVariantProvider variants={[{ ...camo, referencePrice: null }, { ...black, referencePrice: null }]}>
                <PickBuyBox pick={{ ...pick, referencePrice: null, priceCheckedDate: null }} />
            </PickVariantProvider>,
        );

        expect(html).not.toContain('$');
        expect(html).toContain('?variant=1');
    });

    const withPetSmart: ProductPick = {
        ...pick,
        merchants: [{ id: 1, retailer: 'petsmart', retailerName: 'PetSmart', goUrl: 'https://petposture.com/go/pick/balance-harness?retailer=second', price: 40.99, priceCheckedDate: '2026-11-21' }],
    };

    it('gives the PetSmart row its price and a comparison while there is nothing to choose, and not once there is', async () => {
        const single = renderToStaticMarkup(
            <PickVariantProvider>
                <PickBuyBox pick={withPetSmart} today="2026-11-21" />
            </PickVariantProvider>,
        );
        expect(single).toContain('>$40.99<');
        // On a phone only the amount shows: "Lower price · " is hidden up to 560px, "Save $4.96" is not.
        expect(single).toContain('<span class="max-[560px]:hidden">Lower price · </span>Save $4.96</span>');

        const chooser = renderToStaticMarkup(
            <PickVariantProvider variants={[camo, black]}>
                <PickBuyBox pick={withPetSmart} today="2026-11-21" />
            </PickVariantProvider>,
        );
        expect(chooser).toContain('>$45.95<');
        expect(chooser).not.toContain('$40.99');
        expect(chooser).not.toContain('Lower price');
        // the PetSmart button is still there, for the one product that was checked
        expect(chooser).toContain('href="https://petposture.com/go/pick/balance-harness?retailer=second"');
    });

    it('gives every store logo one size (22px, 18px when stacked) and Walmart more height, because its letters fill less of its file', () => {
        const stores =['petsmart', 'amazon', 'petco', 'walmart'] as const;
        const names = { petsmart: 'PetSmart', amazon: 'Amazon', petco: 'Petco', walmart: 'Walmart' };
        const html = renderToStaticMarkup(
            <PickBuyBox
                today="2026-11-21"
                pick={{
                    ...pick,
                    retailerLogo: 'https://cdn.example.test/chewy.webp',
                    merchants: stores.map((retailer, index) => ({
                        id: index + 1, retailer, retailerName: names[retailer], retailerLogo: `https://cdn.example.test/${retailer}.webp`,
                        goUrl: `https://petposture.com/go/pick/balance-harness?merchant=${index + 1}`, price: 50 + index, priceCheckedDate: '2026-11-21',
                    })),
                }}
            />,
        );
        const host = document.createElement('div');
        host.innerHTML = html;
        const classesOf = (alt: string) => host.querySelector(`img[alt="${alt}"]`)!.className.split(' ');

        for (const alt of ['Chewy', 'PetSmart', 'Amazon', 'Petco']) {
            expect(classesOf(alt)).toEqual(expect.arrayContaining(['h-[22px]', 'max-[361px]:h-[18px]', 'w-auto', 'max-w-[min(130px,100%)]', 'object-contain', 'object-left']));
            expect(classesOf(alt)).not.toContain('h-[30px]');
        }
        expect(classesOf('Walmart')).toEqual(expect.arrayContaining(['h-[30px]', 'max-[361px]:h-[24px]', 'w-auto', 'max-w-[min(150px,100%)]', 'object-contain']));
        expect(classesOf('Walmart')).not.toContain('h-[22px]');
    });

    // Tailwind's max-[Npx] means "narrower than N", so max-[441px] is "440px and down", max-[361px] "360px and down".
    it('up to 440px brings the price closer to the Buy button, and up to 360px puts logo and price first, then the date beside Buy, then the saving', () => {
        const host = document.createElement('div');
        host.innerHTML = renderToStaticMarkup(<PickBuyBox pick={withPetSmart} today="2026-11-21" />);
        const [first, cheaper] = [...host.querySelectorAll('[role="row"]')].filter((row) => row.querySelector('a'));
        const classes = (element: Element) => element.className.split(' ');
        const parts = (row: Element) => {
            const [logo, priceCell, date, button] = [...row.querySelectorAll('[role="cell"]')];
            const [price, save] = [...priceCell.querySelectorAll('span')];

            return { logo, price, save, date, button };
        };

        for (const row of [first, cheaper]) {
            const { logo, price, date, button } = parts(row);
            expect(classes(row)).toContain('max-[361px]:grid-cols-[minmax(0,1fr)_auto]');
            expect(classes(price)).toEqual(expect.arrayContaining(['max-[560px]:mr-[40px]', 'max-[441px]:mr-[12px]', 'max-[560px]:col-start-2', 'max-[560px]:row-start-1', 'max-[560px]:justify-self-end']));
            expect(classes(price)).not.toContain('max-[380px]:mr-[12px]');
            // From 412px there is room to spare, so the price sits further left, away from the button.
            expect(classes(price)).toContain('min-[412px]:max-[441px]:mr-[28px]');
            // Logo and price keep the first line. The price runs across both columns there, so however long it is it
            // does not widen the button's column and squeeze the date under the logo.
            expect(classes(logo).filter((name) => /^max-\[361px\]:(col|row)-/.test(name))).toEqual([]);
            expect(classes(price)).toEqual(expect.arrayContaining(['max-[361px]:col-span-2', 'max-[361px]:col-start-1']));
            expect(classes(price).filter((name) => /^max-\[361px\]:row-/.test(name))).toEqual([]);
            expect(classes(date)).toEqual(expect.arrayContaining(['max-[361px]:whitespace-nowrap', 'max-[361px]:text-[length:clamp(11px,3.7vw,0.78rem)]']));
            // An ordinary price keeps its size.
            expect(classes(price)).not.toContain('max-[441px]:text-[1.05rem]');
            expect(classes(date)).toEqual(expect.arrayContaining(['max-[361px]:col-span-1', 'max-[361px]:col-start-1', 'max-[361px]:row-start-2', 'max-[361px]:self-center']));
            // The button is beside the date only, in the same place on every row, so a long saving cannot run into it.
            expect(classes(button)).toEqual(expect.arrayContaining(['max-[361px]:col-start-2', 'max-[361px]:row-start-2', 'max-[361px]:self-center']));
            expect(classes(button).filter((name) => name.includes('row-span'))).toEqual([]);
        }
        // The saving keeps the phone's third line, left-aligned; at 360px and down there are only two columns to span.
        expect(classes(parts(cheaper).save)).toEqual(expect.arrayContaining(['max-[560px]:row-start-3', 'max-[560px]:justify-self-start', 'max-[361px]:col-span-2', 'max-[361px]:col-start-1']));
    });

    it('sets a price of a thousand dollars or more smaller on a phone, so the row shrinks instead of breaking', () => {
        const priceClasses = (referencePrice: number) => {
            const host = document.createElement('div');
            host.innerHTML = renderToStaticMarkup(<PickBuyBox pick={{ ...pick, referencePrice }} today="2026-11-21" />);

            return [...host.querySelectorAll('[role="cell"]')[1].querySelector('span')!.classList];
        };

        expect(priceClasses(999.99)).not.toContain('max-[441px]:text-[1.05rem]');
        expect(priceClasses(1123.99)).toContain('max-[441px]:text-[1.05rem]');
    });

    it('shows no PetSmart row at all, with or without a chooser, until its price and date are entered', () => {
        const unpriced: ProductPick = { ...pick, merchants: [{ ...withPetSmart.merchants![0], price: null, priceCheckedDate: null }] };

        for (const variants of [undefined, [camo, black]]) {
            const html = renderToStaticMarkup(
                <PickVariantProvider variants={variants}>
                    <PickBuyBox pick={unpriced} today="2026-11-21" />
                </PickVariantProvider>,
            );

            expect(html).not.toContain('PetSmart');
            expect(html).not.toContain('retailer=second');
        }
    });

    it('keeps the PetSmart link when another variant is chosen, and changes only the Chewy one', async () => {
        (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        await act(async () => root.render(
            <PickVariantProvider variants={[camo, black]}>
                <PickBuyBox pick={withPetSmart} today="2026-11-21" />
            </PickVariantProvider>,
        ));

        await act(async () => Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Black')!.click());

        const links = Array.from(container.querySelectorAll('a')).map((link) => link.getAttribute('href'));
        expect(links).toEqual([
            'https://petposture.com/go/pick/balance-harness?variant=2',
            'https://petposture.com/go/pick/balance-harness?retailer=second',
        ]);
        expect(container.textContent).toContain('$49.95');
        expect(container.textContent).not.toContain('$40.99');

        await act(async () => root.unmount());
    });
});
