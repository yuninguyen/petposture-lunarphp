import { describe, expect, it } from 'vitest';
import { normalizePickQuery, parsePickSort, picksHref, searchPicks, sortPicks, type PickProduct } from './pick';

describe('search and sort of the Picks list', () => {
    const make = (id: number, name: string, brand: string | undefined, referencePrice: number | null) =>
        ({ id, name, brand, pick: { referencePrice, bestForBreeds: [] } }) as unknown as PickProduct;
    const list = [
        make(3, 'Necoichi Raised Bowl', 'Necoichi', 25),
        make(7, 'rabbitgoo No-Pull Harness', 'rabbitgoo', 18.5),
        make(5, 'Elevated Feeder', undefined, null),
        make(9, 'Puppia Vest Harness', 'Puppia', 18.5),
    ];
    const names = (picks: PickProduct[]) => picks.map((product) => product.name);

    it('finds Picks by name or brand, ignoring case and extra spaces, and needs every word', () => {
        expect(names(searchPicks(list, 'BOWL'))).toEqual(['Necoichi Raised Bowl']);
        expect(names(searchPicks(list, ' rabbitgoo '))).toEqual(['rabbitgoo No-Pull Harness']);
        expect(names(searchPicks(list, 'necoichi'))).toEqual(['Necoichi Raised Bowl']);
        expect(names(searchPicks(list, 'harness  puppia'))).toEqual(['Puppia Vest Harness']);
        expect(searchPicks(list, 'harness bowl')).toEqual([]);
    });

    it('matches the brand even when the name does not contain it', () => {
        const withBrand = [make(1, 'No-Pull Harness', 'rabbitgoo', 10)];

        expect(searchPicks(withBrand, 'rabbitgoo')).toHaveLength(1);
    });

    it('returns every Pick for an empty or blank query, and none when nothing matches', () => {
        expect(searchPicks(list, null)).toBe(list);
        expect(searchPicks(list, '   ')).toBe(list);
        expect(searchPicks(list, 'zzz')).toEqual([]);
        expect(normalizePickQuery('  a   b ')).toBe('a b');
        expect(normalizePickQuery('   ')).toBeNull();
    });

    it('keeps the order the API sent for Featured, and does not change the list it was given', () => {
        const before = names(list);

        expect(sortPicks(list, 'featured')).toEqual(list);
        sortPicks(list, 'name-asc');
        expect(names(list)).toEqual(before);
    });

    it('sorts by price with a Pick without a price last in both directions, ties by name', () => {
        expect(names(sortPicks(list, 'price-asc'))).toEqual(['Puppia Vest Harness', 'rabbitgoo No-Pull Harness', 'Necoichi Raised Bowl', 'Elevated Feeder']);
        expect(names(sortPicks(list, 'price-desc'))).toEqual(['Necoichi Raised Bowl', 'Puppia Vest Harness', 'rabbitgoo No-Pull Harness', 'Elevated Feeder']);
    });

    it('sorts by newest (highest id first) and by name both ways', () => {
        expect(sortPicks(list, 'newest').map((product) => product.id)).toEqual([9, 7, 5, 3]);
        expect(names(sortPicks(list, 'name-asc'))).toEqual(['Elevated Feeder', 'Necoichi Raised Bowl', 'Puppia Vest Harness', 'rabbitgoo No-Pull Harness']);
        expect(names(sortPicks(list, 'name-desc'))).toEqual(['rabbitgoo No-Pull Harness', 'Puppia Vest Harness', 'Necoichi Raised Bowl', 'Elevated Feeder']);
    });

    it('reads a sort from the address and falls back to Featured for anything unknown', () => {
        expect(parsePickSort('price-desc')).toBe('price-desc');
        expect(parsePickSort('nonsense')).toBe('featured');
        expect(parsePickSort(null)).toBe('featured');
    });

    it('puts the words and the sort in the address, drops Featured, and a new search or sort has no page', () => {
        expect(picksHref({ breed: 'pug', solution: null, q: 'bowl', sort: 'price-asc' })).toBe('/picks?breed=pug&q=bowl&sort=price-asc');
        expect(picksHref({ breed: null, solution: null, q: 'dog bowl', sort: 'featured' })).toBe('/picks?q=dog+bowl');
        expect(picksHref({ breed: null, solution: null, q: '  ', sort: null })).toBe('/picks');
        expect(picksHref({ breed: null, solution: null, q: 'bowl', sort: 'name-asc', page: 2 })).toBe('/picks?q=bowl&sort=name-asc&page=2');
    });

    it('reads the address back to the same words and sort', () => {
        const url = new URL(picksHref({ breed: null, solution: null, q: 'dog bowl', sort: 'newest' }), 'https://petposture.com');

        expect(normalizePickQuery(url.searchParams.get('q'))).toBe('dog bowl');
        expect(parsePickSort(url.searchParams.get('sort'))).toBe('newest');
    });
});
