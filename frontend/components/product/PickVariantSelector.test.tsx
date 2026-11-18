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
        expect(container.querySelector('a')!.getAttribute('rel')).toBe('sponsored nofollow noopener');
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
});
