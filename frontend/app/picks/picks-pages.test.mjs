import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const detail = readFileSync(new URL('./[slug]/page.tsx', import.meta.url), 'utf8');
const list = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

// The API sends "id" and never "productId". Matching on productId made "More PetPosture Picks" come out empty:
// every candidate looked like the Pick being viewed.
test('the Pick page picks related Picks by id, through the shared helper, never by productId', () => {
    assert.doesNotMatch(detail, /productId/);
    assert.match(detail, /relatedPicks\(products, current\.id,/);
});

test('the Picks list and a Pick page are rendered per request so their CSP nonce matches the body', () => {
    assert.match(detail, /await headers\(\)/);
    assert.match(list, /await headers\(\)/);
});

test('the Picks list reads both filters, the search words, the sort and the page from the URL and hands them to the list', () => {
    assert.match(list, /breed: rawBreed, solution: rawSolution, q: rawQ, sort: rawSort, page: rawPage/);
    assert.match(list, /<PicksIndex allPicks=\{all\} breed=\{breed\} solution=\{solution\} q=\{q\} sort=\{sort\} page=\{page\}/);
});

test('the Picks list is canonical at /picks for the first page and for every filtered view; page 2 and on have their own', () => {
    assert.match(list, /page > 1 && !filtered \? picksHref\(\{ breed: null, solution: null, page \}\) : '\/picks'/);
});

test('a page past the end goes to the last page', () => {
    assert.match(list, /if \(page > pages\) redirect\(picksHref\(\{ breed, solution, q, sort, page: pages \}\)\)/);
});

// Article <-> Pick links: the Pick page lists the guides that mention it, the article lists its Picks above the comments.
test('the Pick page hands the guides that mention it to the page, read from mentioned_in beside the product', () => {
    assert.match(detail, /mentionedIn: Array\.isArray\(payload\?\.mentioned_in\)/);
    assert.match(detail, /<PickDetails product=\{product\} related=\{related\} mentionedIn=\{lookup\.mentionedIn\} \/>/);
});

test('"Mentioned in" comes after "More PetPosture Picks" on the Pick page', () => {
    const details = readFileSync(new URL('../../components/product/PickDetails.tsx', import.meta.url), 'utf8');

    assert.ok(details.indexOf('More PetPosture Picks') < details.indexOf('<MentionedInPosts posts={mentionedIn} />'));
});

test('the article page hands its Picks to the page, and the Picks section sits above the comments', () => {
    const article = readFileSync(new URL('../blog/[slug]/page.tsx', import.meta.url), 'utf8');
    const articlePage = readFileSync(new URL('../../components/BlogPostPage.tsx', import.meta.url), 'utf8');

    assert.match(article, /picks=\{Array\.isArray\(post\.picks\) \? post\.picks : \[\]\}/);
    assert.ok(articlePage.indexOf('<MentionedPicks') > -1);
    assert.ok(articlePage.indexOf('<MentionedPicks') < articlePage.indexOf('{/* Comments Section */}'));
});
