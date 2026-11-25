import { describe, expect, it } from 'vitest';
import { pageTitle } from './page-title';

describe('pageTitle', () => {
    it('keeps a title that already ends with the brand as it is, outside the layout template', () => {
        expect(pageTitle('Ramp vs Stairs for Dachshunds | PetPosture')).toEqual({
            absolute: 'Ramp vs Stairs for Dachshunds | PetPosture',
        });
    });

    it('recognises the suffix whatever its case and spacing', () => {
        expect(pageTitle('Ramp Guide |petposture ')).toEqual({ absolute: 'Ramp Guide |petposture ' });
    });

    it('leaves a title without the suffix to the template, which adds it once', () => {
        expect(pageTitle('Cooling Mats for Pugs: Warm-Weather Comfort')).toBe('Cooling Mats for Pugs: Warm-Weather Comfort');
    });

    it('does not take the brand name elsewhere in the title for the suffix', () => {
        expect(pageTitle('PetPosture Picks')).toBe('PetPosture Picks');
        expect(pageTitle('Welcome to PetPosture')).toBe('Welcome to PetPosture');
        expect(pageTitle('Guides | PetPosture Blog')).toBe('Guides | PetPosture Blog');
    });
});
