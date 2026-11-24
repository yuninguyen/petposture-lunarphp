// @vitest-environment jsdom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MentionedInPosts, type MentionedPost } from './MentionedInPosts';

const post = (overrides: Partial<MentionedPost> = {}): MentionedPost => ({
    id: 8,
    title: 'Tilted Bowl vs Slow Feeder for French Bulldogs',
    slug: 'tilted-bowl-vs-slow-feeder-for-french-bulldogs',
    category: 'Breed Guides',
    published_at: '2026-11-14T12:00:00.000Z',
    read_time: '5 min read',
    featured_image: 'https://api.petposture.com/storage/media/x.webp',
    featured_image_alt: 'French Bulldog eating from a tilted bowl',
    ...overrides,
});

const render = (posts: MentionedPost[]) => renderToStaticMarkup(<MentionedInPosts posts={posts} />);

describe('MentionedInPosts', () => {
    it('lists each guide with category, date and read time, and a link that opens it', () => {
        const html = render([post()]);

        expect(html).toContain('Mentioned in');
        expect(html).toContain('Guides on PetPosture that mention this pick.');
        expect(html).toContain('Tilted Bowl vs Slow Feeder for French Bulldogs');
        expect(html).toContain('Breed Guides · 14 Nov 2026 · 5 min read');
        expect(html).toContain('href="/blog/tilted-bowl-vs-slow-feeder-for-french-bulldogs"');
        expect(html).toContain('Read the guide →');
        expect(html).toContain('alt="French Bulldog eating from a tilted bowl"');
    });

    it('is left out entirely when no guide mentions the pick', () => {
        expect(render([])).toBe('');
    });

    it('leaves out the parts it does not have, and the photo when there is none', () => {
        const html = render([post({ category: null, read_time: null, published_at: null, featured_image: null })]);

        expect(html).toContain('Read the guide →');
        expect(html).not.toContain('<img');
        expect(html).not.toContain(' · ');
    });

    it('lists several guides, one card each', () => {
        const html = render([post(), post({ id: 10, slug: 'how-to-fit-a-harness', title: 'How to Fit a Harness' })]);

        expect(html.match(/Read the guide →/g)).toHaveLength(2);
        expect(html).toContain('href="/blog/how-to-fit-a-harness"');
    });
});
