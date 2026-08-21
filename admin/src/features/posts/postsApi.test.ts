import { describe, it, expect } from 'vitest';
import { buildPostsQuery } from './postsApi';

describe('buildPostsQuery', () => {
  it('returns the base endpoint when no filters are set', () => {
    expect(buildPostsQuery({})).toBe('/admin/posts');
  });

  it('includes search, status, category, and page params when set', () => {
    expect(buildPostsQuery({ search: 'cat', status: 'published', category: 'nutrition', page: 2 })).toBe(
      '/admin/posts?search=cat&status=published&category=nutrition&page=2'
    );
  });

  it('omits an empty search string', () => {
    expect(buildPostsQuery({ search: '' })).toBe('/admin/posts');
  });
});
import { extractAffiliateNetworks } from './postsApi';

describe('extractAffiliateNetworks', () => {
  it('returns the array as-is when given a bare array', () => {
    const input = [{ name: 'Chewy', slug: 'chewy' }];
    expect(extractAffiliateNetworks(input)).toEqual(input);
  });

  it('returns an empty array for null/undefined input', () => {
    expect(extractAffiliateNetworks(undefined)).toEqual([]);
  });
});
