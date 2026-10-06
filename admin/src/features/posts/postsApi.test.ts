import { describe, it, expect } from 'vitest';
import { buildPostsQuery, extractList } from './postsApi';

describe('extractList', () => {
  const categories = [{ id: '1', name: 'Nutrition', slug: 'nutrition' }];

  it('reads the paginated { data, meta } response of the categories and tags endpoints', () => {
    expect(extractList({ data: categories, meta: { total: 1 } })).toEqual(categories);
  });

  it('accepts a bare array', () => {
    expect(extractList(categories)).toEqual(categories);
  });

  it('returns an empty list for anything else', () => {
    expect(extractList(null)).toEqual([]);
    expect(extractList({})).toEqual([]);
  });
});

describe('buildPostsQuery', () => {
  it('returns the base endpoint when no filters are set', () => {
    expect(buildPostsQuery({})).toBe('/admin/posts');
  });

  it('includes search, status, category, and page params when set', () => {
    expect(buildPostsQuery({ search: 'cat', status: 'published', category: 'nutrition', page: 2 })).toBe(
      '/admin/posts?search=cat&status=published&category=nutrition&page=2'
    );
  });

  it('includes the type param when set', () => {
    expect(buildPostsQuery({ type: 'comparison' })).toBe('/admin/posts?type=comparison');
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
