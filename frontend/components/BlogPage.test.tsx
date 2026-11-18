import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import BlogPage from './BlogPage';

vi.mock('@/components/Header', () => ({ default: () => null }));
vi.mock('@/components/Footer', () => ({ default: () => null }));
vi.mock('@/context/SettingsContext', () => ({ useSettings: () => ({ social: {} }) }));

const post = (id: number, title: string) => ({
    id, slug: `post-${id}`, title, content: '<p>Body text of the post.</p>', created_at: '2026-11-10T00:00:00Z', published_at: '2026-11-10T00:00:00Z',
    featured_image: null, featured_image_alt: null, blog_category: { name: 'Guides' }, tags: [],
});

const data = { posts: [post(1, 'Featured story'), post(2, 'Second story'), post(3, 'Third story'), post(4, 'Fourth story'), post(5, 'Fifth story')], categories: [] };

const levels = (html: string) => [...html.matchAll(/<h([1-6])[\s>]/g)].map((match) => Number(match[1]));
const render = (initialData: unknown) => renderToStaticMarkup(<BlogPage initialData={initialData as never} />);

describe('BlogPage headings', () => {
    it('has one h1, the page title, hidden visually, and the featured story is an h2', () => {
        const html = render(data);

        expect(html).toMatch(/<h1 class="sr-only">PetPosture Blog<\/h1>/);
        expect(levels(html).filter((level) => level === 1)).toHaveLength(1);
        expect(html).toMatch(/<h2[^>]*>\s*Featured story\s*<\/h2>/);
    });

    it('goes down one level at a time, never skipping', () => {
        const all = levels(render(data));

        expect(all[0]).toBe(1);
        all.slice(1).forEach((level, index) => expect(level, `heading ${index + 2} jumps from h${all[index]}`).toBeLessThanOrEqual(all[index] + 1));
    });

    it('still has its h1 when the server could not load the posts and only the waiting screen is drawn', () => {
        const html = render(null);

        expect(html).toContain('Curating your feed');
        expect(html).toMatch(/<h1 class="sr-only">PetPosture Blog<\/h1>/);
    });
});
