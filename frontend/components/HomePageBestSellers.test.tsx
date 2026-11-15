// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Product, ProductPick } from '../types/shop';
import { PicksBlock } from './HomePage';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const pick: ProductPick = {
    retailer: 'chewy',
    retailerName: 'Chewy',
    goUrl: 'https://api.petposture.com/go/pick/harness',
    referencePrice: 25.99,
    priceCheckedDate: '2026-11-15',
    bestForBreeds: ['french-bulldog'],
    pros: [],
    cons: [],
};

// Stock 0 on purpose: a Pick has no PetPosture stock.
const product = {
    id: 1, productId: 1, variantId: 10, slug: 'harness', name: 'Soft Harness', brand: 'Puppia', category: 'Harnesses',
    categorySlug: 'harnesses', price: 22.71, rating: 4.6, reviews: 12, image: '/storage/harness.png',
    available: false, stockStatus: 'out_of_stock', pick,
} as Product;

let root: Root | null = null;

afterEach(() => {
    if (root) act(() => root!.unmount());
    root = null;
    vi.unstubAllGlobals();
});

async function renderInBrowser(initialProducts: Product[] | null | undefined) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root!.render(<PicksBlock initialProducts={initialProducts} />));
    return host;
}

describe('homepage PetPosture Picks block', () => {
    it('renders nothing when there are no picks, not an empty box or a placeholder', () => {
        expect(renderToStaticMarkup(<PicksBlock initialProducts={[]} />)).toBe('');
    });

    it('renders nothing on the server while the picks are still unknown', () => {
        expect(renderToStaticMarkup(<PicksBlock initialProducts={null} />)).toBe('');
    });

    it('stays hidden, with no raw error message, when the browser fallback request fails', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch products: 403')));

        const host = await renderInBrowser(null);

        expect(host.innerHTML).toBe('');
    });

    it('stays hidden when the browser fallback finds no Pick among the products', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ id: 1, pick: null }] }))));

        const host = await renderInBrowser(null);

        expect(host.innerHTML).toBe('');
    });

    it('fills the block from the browser fallback with the Picks only', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
            data: [{ id: 1, name: 'Ordinary', slug: 'ordinary', pick: null }, product],
        }))));

        const host = await renderInBrowser(null);

        expect(host.innerHTML).toContain('Soft Harness');
        expect(host.innerHTML).not.toContain('Ordinary');
    });

    it('shows each Pick as a card that opens its own /picks page', () => {
        const html = renderToStaticMarkup(<PicksBlock initialProducts={[product]} />);

        expect(html).toContain('PetPosture Picks');
        expect(html).toContain('Soft Harness');
        expect(html).toContain('href="/picks/harness"');
    });

    it('has no cart, wishlist, stock, price or shop link on a card', () => {
        const html = renderToStaticMarkup(<PicksBlock initialProducts={[product]} />);
        const lower = html.toLowerCase();

        for (const banned of ['add to cart', 'wishlist', 'in stock', 'out of stock', 'low stock', 'backorder', 'reviews', '22.71', '$']) {
            expect(lower, banned).not.toContain(banned);
        }
        expect(html).not.toMatch(/href="\/(shop|cart|checkout)/);
    });
});
