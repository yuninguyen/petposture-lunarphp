import { describe, it, expect } from 'vitest';
import { postFormSchema } from './postSchema';

describe('postFormSchema', () => {
  it('accepts a valid draft post', () => {
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
