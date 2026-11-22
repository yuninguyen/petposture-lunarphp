import { describe, expect, it } from 'vitest';
import { easternReadout, postChecklist, type PostChecklistInput } from './postChecklist';

const description = (length: number) => 'a'.repeat(length);
const base: PostChecklistInput = {
  seoTitle: 'How to pick a dog ramp',
  seoDescription: description(140),
  hasFeaturedImage: true,
  featuredImageAlt: 'A dog on a ramp',
  breedCount: 1,
  solutionCount: 1,
  tagCount: 2,
  status: 'draft',
  publishedAt: '',
};
const item = (input: PostChecklistInput, id: string) => postChecklist(input).find((entry) => entry.id === id);

describe('postChecklist', () => {
  it('is all ok for a complete draft, and a draft has no publish-time line', () => {
    const items = postChecklist(base);

    expect(items.map((entry) => entry.id)).toEqual(['seo_title', 'meta_description', 'featured_image', 'tags']);
    expect(items.every((entry) => entry.status === 'ok')).toBe(true);
  });

  it('wants an SEO title of at most 60 characters', () => {
    expect(item({ ...base, seoTitle: '  ' }, 'seo_title')).toMatchObject({ status: 'missing' });
    expect(item({ ...base, seoTitle: 'x'.repeat(60) }, 'seo_title')).toMatchObject({ status: 'ok', params: { count: 60 } });
    expect(item({ ...base, seoTitle: 'x'.repeat(61) }, 'seo_title')).toMatchObject({ status: 'warn', detail: 'posts.checklist.detail.seo_title_long', params: { count: 61 } });
  });

  it('wants a meta description of 120 to 160 characters', () => {
    expect(item({ ...base, seoDescription: '' }, 'meta_description')).toMatchObject({ status: 'missing' });
    expect(item({ ...base, seoDescription: description(119) }, 'meta_description')).toMatchObject({ status: 'warn', detail: 'posts.checklist.detail.description_short' });
    expect(item({ ...base, seoDescription: description(120) }, 'meta_description')).toMatchObject({ status: 'ok' });
    expect(item({ ...base, seoDescription: description(160) }, 'meta_description')).toMatchObject({ status: 'ok' });
    expect(item({ ...base, seoDescription: description(161) }, 'meta_description')).toMatchObject({ status: 'warn', detail: 'posts.checklist.detail.description_long' });
  });

  it('wants a featured image and its alt text', () => {
    expect(item({ ...base, hasFeaturedImage: false }, 'featured_image')).toMatchObject({ status: 'missing', detail: 'posts.checklist.detail.image_missing' });
    expect(item({ ...base, featuredImageAlt: '  ' }, 'featured_image')).toMatchObject({ status: 'missing', detail: 'posts.checklist.detail.image_alt_missing' });
  });

  it('wants at least one breed or solution, and mentions the other tags', () => {
    expect(item({ ...base, breedCount: 0, solutionCount: 0, tagCount: 5 }, 'tags')).toMatchObject({ status: 'missing' });
    expect(item({ ...base, breedCount: 0, solutionCount: 2 }, 'tags')).toMatchObject({ status: 'ok', params: { breeds: 0, solutions: 2, tags: 2 } });
  });

  describe('publish time', () => {
    const scheduled = { ...base, status: 'scheduled' as const };
    // 2026-11-21 12:00 UTC is 07:00 in New York.
    const now = Date.UTC(2026, 10, 21, 12, 0);

    it('only matters for a scheduled post', () => {
      expect(item({ ...base, status: 'published', publishedAt: '2026-11-21T10:47' }, 'schedule')).toBeUndefined();
    });

    it('is missing when a scheduled post has no time', () => {
      expect(item({ ...scheduled, publishedAt: '' }, 'schedule')).toMatchObject({ status: 'missing' });
    });

    it('shows the time in Eastern when it is still ahead, and warns when it has passed', () => {
      expect(item({ ...scheduled, publishedAt: '2026-11-21T10:47', now }, 'schedule')).toMatchObject({ status: 'ok', params: { time: 'Nov 21, 2026, 10:47 AM ET' } });
      expect(item({ ...scheduled, publishedAt: '2026-11-21T06:30', now }, 'schedule')).toMatchObject({ status: 'warn', detail: 'posts.checklist.detail.schedule_past' });
    });
  });

  it('never produces a total score', () => {
    expect(JSON.stringify(postChecklist(base))).not.toMatch(/score|\/100/i);
  });
});

describe('easternReadout', () => {
  it('formats the wall time that was typed, without moving it to another time zone', () => {
    expect(easternReadout('2026-11-21T10:47')).toBe('Nov 21, 2026, 10:47 AM');
    expect(easternReadout('2026-07-04T22:05')).toBe('Jul 4, 2026, 10:05 PM');
    expect(easternReadout('2026-11-21T00:00')).toBe('Nov 21, 2026, 12:00 AM');
  });

  it('is empty when there is nothing usable', () => {
    expect(easternReadout('')).toBe('');
    expect(easternReadout(null)).toBe('');
    expect(easternReadout('not a date')).toBe('');
  });
});
