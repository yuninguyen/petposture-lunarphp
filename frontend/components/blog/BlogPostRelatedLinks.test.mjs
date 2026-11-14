import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync(new URL('../../app/blog/[slug]/page.tsx', import.meta.url), 'utf8');
const postPage = readFileSync(new URL('../BlogPostPage.tsx', import.meta.url), 'utf8');

test('the blog route passes the breeds and solutions a post is tagged with to the page', () => {
  assert.ok(page.includes('breeds?: { id: string; name: string; slug?: string | null }[]'), 'ApiPost declares breeds');
  assert.ok(page.includes('solutions?: { id: string; name: string; slug?: string | null }[]'), 'ApiPost declares solutions');
  assert.match(page, /breeds:\s*withSlug\(post\.breeds\)/);
  assert.match(page, /solutions:\s*withSlug\(post\.solutions\)/);
});

test('only entries with a slug become links, because a link needs a target', () => {
  assert.match(page, /function withSlug/);
  assert.match(page, /\.filter\(\(item\): item is \{ name: string; slug: string \} => Boolean\(item\.slug\)\)/);
});

test('the post page links each tagged breed to its guide and each solution to its guide', () => {
  assert.ok(postPage.includes('href={`/dogs/${breed.slug}`}'), 'breed links go to /dogs/<slug>');
  assert.ok(postPage.includes('href={`/solutions/${solution.slug}`}'), 'solution links go to /solutions/<slug>');
  assert.ok(postPage.includes('post.breeds.length > 0 || post.solutions.length > 0'), 'the block is hidden when the post has neither');
});
