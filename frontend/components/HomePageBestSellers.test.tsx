// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../types/shop';
import { BestSellers } from './HomePage';

vi.mock('@/components/shop/ProductCard', () => ({
    ProductCard: ({ product }: { product: Product }) => <article>{product.name}</article>,
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const product = { id: 1, productId: 1, variantId: 10, slug: 'harness', name: 'Soft Harness' } as Product;

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
    await act(async () => root!.render(<BestSellers initialProducts={initialProducts} />));
    return host;
}

describe('homepage PetPosture Picks block', () => {
    it('renders nothing when there are no products, not an empty box or a placeholder', () => {
        const html = renderToStaticMarkup(<BestSellers initialProducts={[]} />);

        expect(html).toBe('');
    });

    it('renders nothing on the server while the products are still unknown', () => {
        const html = renderToStaticMarkup(<BestSellers initialProducts={null} />);

        expect(html).toBe('');
    });

    it('stays hidden, with no raw error message, when the browser fallback request fails', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch products: 403')));

        const host = await renderInBrowser(null);

        expect(host.innerHTML).toBe('');
    });

    it('stays hidden when the browser fallback request returns no products', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] }))));

        const host = await renderInBrowser(null);

        expect(host.innerHTML).toBe('');
    });

    it('shows the block with its products when there are some', () => {
        const html = renderToStaticMarkup(<BestSellers initialProducts={[product]} />);

        expect(html).toContain('PetPosture Picks');
        expect(html).toContain('Soft Harness');
    });
});
