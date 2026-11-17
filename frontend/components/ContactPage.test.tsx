// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ContactPage from './ContactPage';

let address: string | null = null;

vi.mock('@/components/Header', () => ({ default: () => null }));
vi.mock('@/components/Footer', () => ({ default: () => null }));
vi.mock('@/context/SettingsContext', () => ({
    useSettings: () => ({ contact: { phone: '+1 (916) 623-5368', address } }),
}));

describe('Contact page', () => {
    beforeEach(() => {
        address = null;
    });

    it('shows no office card while the business has no address set', () => {
        const html = renderToStaticMarkup(<ContactPage />);

        expect(html).not.toContain('Our Office');
        expect(html).not.toContain('Cheyenne');
    });

    it('shows the office card once an address is entered in the admin', () => {
        address = '1 Main St, Cheyenne, WY 82001, United States';

        const html = renderToStaticMarkup(<ContactPage />);

        expect(html).toContain('Our Office');
        expect(html).toContain('1 Main St');
    });

    // SHOP-HIDDEN: reverted together with the rest of the "hide the shop" commit when the shop reopens.
    it('does not ask for an order number or promise order help while the shop is hidden', () => {
        const html = renderToStaticMarkup(<ContactPage />);

        expect(html).not.toContain('Order Number');
        expect(html).not.toContain('order tracking');
        expect(html).not.toContain('shipping, returns');
    });

    it('copies a ready-made subject and tells the visitor where to paste it', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
        (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        await act(async () => root.render(<ContactPage />));

        const button = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Supplier'));
        expect(button).toBeTruthy();
        expect(container.textContent).toContain('Copy “Affiliate”');

        await act(async () => button!.click());

        expect(writeText).toHaveBeenCalledWith('Supplier');
        expect(container.textContent).toContain('Copied “Supplier” — paste it into the Subject line of your email.');
        await act(async () => root.unmount());
    });

    it('invites brands to write about dropship and affiliate work', () => {
        const html = renderToStaticMarkup(<ContactPage />);

        expect(html).toContain('For brands: dropship &amp; affiliate');
        expect(html).toContain('href="mailto:support@petposture.com"');
        expect(html).toContain('src="/assets/contact/brands-french-bulldog.webp"');
    });
});
