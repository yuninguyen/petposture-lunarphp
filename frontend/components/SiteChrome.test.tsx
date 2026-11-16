// @vitest-environment jsdom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import Footer from './Footer';
import Header from './Header';
import { SocialProofStrip } from './HomePage';

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

    it('has no cart or wishlist icon', () => {
        expect(html).not.toContain('aria-label="Shopping cart"');
        expect(html).not.toContain('aria-label="Wishlist"');
        expect(html).not.toContain('href="/wishlist"');
    });

    it('keeps the rest of the navigation and the account icon', () => {
        expect(html).toContain('Our Mission');
        expect(html).toContain('Blog');
        expect(html).toContain('Contact');
    });

    it('has no sign-in or register link for a visitor, in the bar or the mobile menu', () => {
        expect(html).not.toContain('href="/sign-in"');
        expect(html).not.toContain('href="/sign-up"');
        expect(html).not.toMatch(/Login \/ Register/i);
        expect(html).not.toContain('aria-label="Login or register"');
    });
});

describe('homepage trust strip', () => {
    const html = renderToStaticMarkup(<SocialProofStrip />);

    it('no longer promises returns or free shipping', () => {
        const lower = html.toLowerCase();

        expect(lower).not.toContain('returns');
        expect(lower).not.toContain('shipping');
        expect(lower).not.toContain('delivery');
    });

    it('keeps the two claims that are about the guides', () => {
        expect(html).toContain('Breed-Focused');
        expect(html).toContain('Curated Selection');
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

    it('has no order tracking link', () => {
        expect(html.toLowerCase()).not.toContain('track your order');
        expect(html).not.toContain('href="/track-order"');
    });

    it('keeps the contact, FAQ and legal links', () => {
        expect(html).toContain('href="/contact"');
        expect(html).toContain('href="/faqs"');
        expect(html).toContain('href="/privacy-policy"');
        expect(html).toContain('href="/affiliate-disclosure"');
    });
});
