import { z } from 'zod';

export type TranslationFunction = (key: string) => string;

export const getPostFormSchema = (t: TranslationFunction) =>
  z.object({
    title: z.string().min(1, t('posts.validation_title_required')).max(255),
    content: z.string().min(1, t('posts.validation_content_required')),
    blog_category_id: z.string().min(1, t('posts.validation_category_required')),
    status: z.enum(['draft', 'published']),
    featured_media_id: z.string().nullable(),
    author: z.string().optional(),
  });

export type PostFormValues = z.infer<ReturnType<typeof getPostFormSchema>>;
