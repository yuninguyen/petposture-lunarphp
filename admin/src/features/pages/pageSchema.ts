import { z } from 'zod';
import { TFunction } from 'i18next';

export const getPageFormSchema = (t: TFunction) => z.object({
  title: z.string().min(1, { message: t('posts.errors.title_required') }),
  slug: z.string().min(1, { message: t('posts.errors.slug_required') }),
  content: z.string().min(1, { message: t('posts.errors.content_required') }),
  is_active: z.boolean().default(true),
  meta_title: z.string().nullable().optional(),
  meta_description: z.string().nullable().optional(),
  status: z.enum(['draft', 'invisible', 'published']),
});

export type PageFormValues = z.infer<ReturnType<typeof getPageFormSchema>>;
