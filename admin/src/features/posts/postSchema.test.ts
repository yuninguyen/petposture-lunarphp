import { describe, it, expect } from 'vitest';
import { getPostFormSchema } from './postSchema';

// Mock translation function for testing
const mockT = (key: string) => key;

describe('postFormSchema', () => {
  it('accepts a valid draft post', () => {
    const postFormSchema = getPostFormSchema(mockT);
    const result = postFormSchema.safeParse({
      title: 'A valid title',
      content: '<p>Body</p>',
      blog_category_id: '1',
      status: 'draft',
      featured_media_id: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty title', () => {
    const postFormSchema = getPostFormSchema(mockT);
    const result = postFormSchema.safeParse({
      title: '',
      content: '<p>Body</p>',
      blog_category_id: '1',
      status: 'draft',
      featured_media_id: null,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a missing category', () => {
    const postFormSchema = getPostFormSchema(mockT);
    const result = postFormSchema.safeParse({
      title: 'Title',
      content: '<p>Body</p>',
      blog_category_id: '',
      status: 'draft',
      featured_media_id: null,
    });
    expect(result.success).toBe(false);
  });

  it('accepts an optional author field', () => {
    const postFormSchema = getPostFormSchema(mockT);
    const result = postFormSchema.safeParse({
      title: 'Title',
      content: '<p>Body</p>',
      blog_category_id: '1',
      status: 'draft',
      featured_media_id: null,
      author: 'Yuni Nguyen',
    });
    expect(result.success).toBe(true);
  });
});
const t = (key: string) => key;

describe('getPostFormSchema — comparison fields', () => {
  const baseValues = {
    blog_category_id: '1',
    title: 'Best Beds',
    slug: 'best-beds',
    content: '<p>x</p>',
    status: 'draft' as const,
    type: 'comparison' as const,
  };

  const validItem = {
    product_name: 'Orthopedic Bed',
    image_url: null,
    retailer: 'chewy',
    highlight: '',
    in_stock: true,
    price_display: '$64.99',
    price_cents: 6499,
    rating: 4.7,
    affiliate_url: 'https://chewy.com/p/1',
    pros: ['comfy'],
    cons: ['pricey'],
    in_house_match_url: '',
  };

  it('accepts a valid comparison payload', () => {
    const schema = getPostFormSchema(t);
    const result = schema.safeParse({
      ...baseValues,
      comparison_intro: 'Top picks',
      disclosure_shown: true,
      comparison_items: [validItem],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a comparison item missing product_name', () => {
    const schema = getPostFormSchema(t);
    const result = schema.safeParse({
      ...baseValues,
      comparison_items: [{ ...validItem, product_name: '' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a comparison item with an invalid affiliate_url', () => {
    const schema = getPostFormSchema(t);
    const result = schema.safeParse({
      ...baseValues,
      comparison_items: [{ ...validItem, affiliate_url: 'not-a-url' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a rating above 5', () => {
    const schema = getPostFormSchema(t);
    const result = schema.safeParse({
      ...baseValues,
      comparison_items: [{ ...validItem, rating: 6 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a rating below 0', () => {
    const schema = getPostFormSchema(t);
    const result = schema.safeParse({
      ...baseValues,
      comparison_items: [{ ...validItem, rating: -1 }],
    });
    expect(result.success).toBe(false);
  });

  it('treats an empty-string rating as undefined (not zero)', () => {
    const schema = getPostFormSchema(t);
    const result = schema.safeParse({
      ...baseValues,
      comparison_items: [{ ...validItem, rating: '' }],
    });
    expect(result.success).toBe(true);
  });

  it('treats an empty-string highlight as undefined', () => {
    const schema = getPostFormSchema(t);
    const result = schema.safeParse({
      ...baseValues,
      comparison_items: [{ ...validItem, highlight: '' }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.comparison_items?.[0].highlight).toBeUndefined();
    }
  });

  it('allows article type posts without any comparison fields', () => {
    const schema = getPostFormSchema(t);
    const result = schema.safeParse({
      ...baseValues,
      type: 'article',
      comparison_items: undefined,
    });
    expect(result.success).toBe(true);
  });

  it('rejects comparison_items with an empty pros/cons array item', () => {
    const schema = getPostFormSchema(t);
    const result = schema.safeParse({
      ...baseValues,
      comparison_items: [{ ...validItem, pros: [''] }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts comparison_items with empty pros/cons arrays', () => {
    const schema = getPostFormSchema(t);
    const result = schema.safeParse({
      ...baseValues,
      comparison_items: [{ ...validItem, pros: [], cons: [] }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects price_cents as a negative number', () => {
    const schema = getPostFormSchema(t);
    const result = schema.safeParse({
      ...baseValues,
      comparison_items: [{ ...validItem, price_cents: -100 }],
    });
    expect(result.success).toBe(false);
  });

  it('allows in_house_match_url to be an empty string', () => {
    const schema = getPostFormSchema(t);
    const result = schema.safeParse({
      ...baseValues,
      comparison_items: [{ ...validItem, in_house_match_url: '' }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid in_house_match_url', () => {
    const schema = getPostFormSchema(t);
    const result = schema.safeParse({
      ...baseValues,
      comparison_items: [{ ...validItem, in_house_match_url: 'not-a-url' }],
    });
    expect(result.success).toBe(false);
  });
});

const validHighlightItem = {
  product_name: 'Orthopedic Bed',
  image_url: null,
  retailer: 'chewy',
  in_stock: true,
  price_display: '$64.99',
  price_cents: 6499,
  rating: 4.7,
  affiliate_url: 'https://chewy.com/p/1',
  pros: ['comfy'],
  cons: [],
  in_house_match_url: '',
};

describe('getPostFormSchema — taxonomy, seo, published_at, highlight enum', () => {
  const baseValues = {
    blog_category_id: '1',
    title: 'A Post',
    content: '<p>x</p>',
    status: 'draft' as const,
    type: 'article' as const,
  };

  it('defaults breeds/solutions/tags to empty arrays', () => {
    const schema = getPostFormSchema(t);
    const result = schema.safeParse(baseValues);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.breeds).toEqual([]);
      expect(result.data.solutions).toEqual([]);
      expect(result.data.tags).toEqual([]);
    }
  });

  it('accepts string-id arrays for breeds/solutions/tags', () => {
    const schema = getPostFormSchema(t);
    const result = schema.safeParse({
      ...baseValues,
      breeds: ['1', '2'],
      solutions: ['3'],
      tags: ['4'],
    });
    expect(result.success).toBe(true);
  });

  it('accepts an empty-string published_at', () => {
    const schema = getPostFormSchema(t);
    const result = schema.safeParse({ ...baseValues, published_at: '' });
    expect(result.success).toBe(true);
  });

  it('accepts a full seo object', () => {
    const schema = getPostFormSchema(t);
    const result = schema.safeParse({
      ...baseValues,
      seo: {
        title: 'SEO Title',
        keyphrase: 'dog ramps',
        description: 'Meta description',
        og_title: 'Social Title',
        og_description: 'Social description',
        og_image: null,
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects a seo title over 60 characters', () => {
    const schema = getPostFormSchema(t);
    const result = schema.safeParse({
      ...baseValues,
      seo: { title: 'a'.repeat(61) },
    });
    expect(result.success).toBe(false);
  });

  it('rejects a seo description over 160 characters', () => {
    const schema = getPostFormSchema(t);
    const result = schema.safeParse({
      ...baseValues,
      seo: { description: 'a'.repeat(161) },
    });
    expect(result.success).toBe(false);
  });

  it('accepts all three enum highlight values and empty string', () => {
    const schema = getPostFormSchema(t);
    for (const highlight of ['best_overall', 'best_value', 'budget_pick', '']) {
      const result = schema.safeParse({
        ...baseValues,
        type: 'comparison',
        comparison_items: [{ ...validHighlightItem, highlight }],
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects an out-of-enum highlight value', () => {
    const schema = getPostFormSchema(t);
    const result = schema.safeParse({
      ...baseValues,
      type: 'comparison',
      comparison_items: [{ ...validHighlightItem, highlight: 'Best Value' }],
    });
    expect(result.success).toBe(false);
  });
});
