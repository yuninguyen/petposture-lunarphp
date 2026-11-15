import { describe, expect, it } from 'vitest';
import { GET } from './route';

// SHOP-HIDDEN: llms.txt is read by AI crawlers. While the shop is hidden it must not describe PetPosture as a
// store or send them to /shop.
describe('llms.txt', () => {
    it('does not point crawlers at the hidden shop or call the site a store', async () => {
        const text = await GET().text();

        expect(text).not.toMatch(/\/shop(\/|\))/);
        expect(text.toLowerCase()).not.toContain('e-commerce');
        expect(text.toLowerCase()).not.toContain('store');
        expect(text.toLowerCase()).not.toContain('catalog');
    });

    it('still lists the home page, the mission, the blog and the breed guides', async () => {
        const text = await GET().text();

        for (const path of ['/our-mission', '/blog', '/dogs/dachshund', '/dogs/french-bulldog', '/dogs/pug']) {
            expect(text, path).toContain(path);
        }
    });
});
