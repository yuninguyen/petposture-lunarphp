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
});
