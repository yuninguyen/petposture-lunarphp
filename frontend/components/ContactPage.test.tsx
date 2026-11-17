// @vitest-environment jsdom
import React from 'react';
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

    it('invites brands to write about dropship and affiliate work', () => {
        const html = renderToStaticMarkup(<ContactPage />);

        expect(html).toContain('For brands: dropship &amp; affiliate');
        expect(html).toContain('href="mailto:support@petposture.com"');
    });
});
