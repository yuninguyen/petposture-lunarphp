// @vitest-environment jsdom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import Header from './Header';

vi.mock('@/context/CartContext', () => ({ useCart: () => ({ items: [], setCartOpen: vi.fn() }) }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: null, logout: vi.fn() }) }));
vi.mock('@/context/WishlistContext', () => ({ useWishlist: () => ({ items: [] }) }));
vi.mock('@/context/SettingsContext', () => ({
    useSettings: () => ({ shop_name: 'PetPosture', shop_logo: null, description: '', contact: { phone: '' }, social: {} }),
}));
vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push: vi.fn() }) }));

// Kept apart from SiteChrome.test.tsx, which only exists while the shop is hidden, so reopening the shop keeps this.
describe('Picks in the site header', () => {
    it('links to the Picks list from the desktop and the mobile menu', () => {
        const html = renderToStaticMarkup(<Header />);

        expect(html.match(/href="\/picks"/g)?.length).toBeGreaterThanOrEqual(1);
        expect(html).toContain('Picks');
    });
});
