// @vitest-environment jsdom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import Footer from './Footer';
import Header from './Header';

vi.mock('@/context/CartContext', () => ({ useCart: () => ({ items: [], setCartOpen: vi.fn() }) }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: null, logout: vi.fn() }) }));
vi.mock('@/context/WishlistContext', () => ({ useWishlist: () => ({ items: [] }) }));
vi.mock('@/context/SettingsContext', () => ({
    useSettings: () => ({ shop_name: 'PetPosture', shop_logo: null, description: '', contact: { phone: '' }, social: {} }),
}));
vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push: vi.fn() }) }));

// SHOP-HIDDEN: the site header and footer must not sell anything while the shop is hidden.
describe('site header', () => {
    const html = renderToStaticMarkup(<Header />);

    it('has no free-shipping announcement', () => {
        expect(html.toLowerCase()).not.toContain('shipping');
        expect(html).not.toContain('over $50');
    });

    it('has no product search box, which only searched the hidden shop', () => {
        expect(html).not.toContain('<input');
        expect(html).not.toContain('aria-label="Search"');
        expect(html).not.toContain('<form');
    });

    it('does not link into the shop', () => {
        expect(html).not.toMatch(/href="\/shop/);
    });

    it('keeps the rest of the navigation', () => {
        expect(html).toContain('Our Mission');
        expect(html).toContain('Blog');
        expect(html).toContain('Contact');
    });
});

describe('site footer', () => {
    const html = renderToStaticMarkup(<Footer />);

    it('has no shipping or return policy links', () => {
        const lower = html.toLowerCase();

        expect(lower).not.toContain('shipping policy');
        expect(lower).not.toContain('return &amp; refund');
        expect(lower).not.toContain('request a return');
        expect(html).not.toContain('href="/shipping-policy"');
        expect(html).not.toContain('href="/return-refund-policy"');
        expect(html).not.toContain('href="/returns"');
    });

    it('shows no payment card icons', () => {
        for (const brand of ['Visa', 'Mastercard', 'American Express', 'Discover', 'PayPal', 'Apple Pay', 'Google Pay']) {
            expect(html, brand).not.toContain(`title="${brand}"`);
        }
    });

    it('keeps the contact, FAQ and legal links', () => {
        expect(html).toContain('href="/contact"');
        expect(html).toContain('href="/faqs"');
        expect(html).toContain('href="/privacy-policy"');
        expect(html).toContain('href="/affiliate-disclosure"');
    });
});
