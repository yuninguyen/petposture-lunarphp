// SHOP-HIDDEN: grep this marker to find everything changed when the shop was hidden.
// To reopen the shop, revert the "hide the shop" commit (Step 1 of the Picks work).
// The shop is hidden: PetPosture sends readers to the guides instead of selling.
// Every retired shop URL maps to the closest guide page, or to the homepage when
// none exists. Redirects are temporary (302) so the shop can come back later.

const BREED_GUIDE_SLUGS = new Set(['corgi', 'dachshund', 'english-bulldog', 'french-bulldog', 'pug']);
const SOLUTION_GUIDE_SLUGS = new Set(['comfort', 'feeding', 'mobility', 'walking']);

export function resolveShopRedirect(pathname: string): string | null {
    const breed = pathname.match(/^\/shop\/breeds\/([^/]+)$/)?.[1];
    if (breed && BREED_GUIDE_SLUGS.has(breed)) return `/dogs/${breed}`;

    const solution = pathname.match(/^\/shop\/solutions\/([^/]+)$/)?.[1];
    if (solution && SOLUTION_GUIDE_SLUGS.has(solution)) return `/solutions/${solution}`;

    if (
        pathname === '/shop' ||
        pathname.startsWith('/shop/') ||
        pathname === '/cart' ||
        pathname === '/checkout' ||
        pathname.startsWith('/product/')
    ) {
        return '/';
    }

    return null;
}
