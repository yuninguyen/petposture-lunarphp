import { describe, expect, it } from 'vitest';
import { CATEGORIES, FAQ_ITEMS } from './faq-data';

// SHOP-HIDDEN: while the shop is hidden PetPosture ships nothing and takes no returns or orders,
// so the FAQ must not answer as if it did.
describe('FAQ data', () => {
    it('has no shipping or orders-and-returns category', () => {
        expect(CATEGORIES.map((category) => category.id)).not.toContain('shipping');
        expect(CATEGORIES.map((category) => category.id)).not.toContain('orders');
    });

    it('has no question or answer about shipping, returns, refunds or orders', () => {
        for (const item of FAQ_ITEMS) {
            const text = `${item.question} ${item.answer}`.toLowerCase();

            for (const banned of ['shipping', 'ship ', 'return', 'refund', 'restocking', 'my order', 'your order', 'tracking number']) {
                expect(text, `${item.question} -> ${banned}`).not.toContain(banned);
            }
        }
    });

    it('gives every question a category that exists', () => {
        const ids = CATEGORIES.map((category) => category.id);

        for (const item of FAQ_ITEMS) {
            expect(ids).toContain(item.category);
        }
    });

    it('keeps the product questions', () => {
        expect(FAQ_ITEMS.length).toBeGreaterThan(0);
        expect(CATEGORIES.map((category) => category.id)).toContain('products');
    });
});
