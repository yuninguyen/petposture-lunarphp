import { z } from 'zod';

export type TranslationFunction = (key: string) => string;

const comparisonItemSchema = (t: TranslationFunction) =>
  z.object({
    product_name: z.string().min(1, t('posts.comparison.errors.product_name_required')),
    image_url: z.string().nullable().optional(),
    retailer: z.string().min(1, t('posts.comparison.errors.retailer_required')),
    highlight: z.preprocess(
      (val) => (val === '' ? undefined : val),
      z.string().max(255).optional()
    ),
    in_stock: z.boolean().optional(),
    price_display: z.string().max(64).optional(),
    price_cents: z.preprocess(
      (val) => (val === '' || val === undefined ? undefined : Number(val)),
      z.number().int().min(0).optional()
    ),
    rating: z.preprocess(
      (val) => (val === '' || val === undefined || val === null ? undefined : Number(val)),
      z.number().min(0).max(5).optional()
    ),
    affiliate_url: z.string().url(t('posts.comparison.errors.affiliate_url_invalid')),
    pros: z.array(z.string().min(1, t('posts.comparison.errors.list_item_required'))).optional(),
    cons: z.array(z.string().min(1, t('posts.comparison.errors.list_item_required'))).optional(),
    in_house_match_url: z.preprocess(
      (val) => (val === '' ? undefined : val),
      z.string().url(t('posts.comparison.errors.match_url_invalid')).optional()
    ),
  });

export type ComparisonItemValues = z.infer<ReturnType<typeof comparisonItemSchema>>;

export const getPostFormSchema = (t: TranslationFunction) =>
  z.object({
    blog_category_id: z.string().min(1, t('posts.errors.category_required')),
    title: z.string().min(1, t('posts.errors.title_required')).max(255),
    // Slug is generated server-side when absent (PostController::store), so the
    // admin form never collects it — keep it optional in the client schema.
    slug: z.string().min(1, t('posts.errors.slug_required')).optional(),
    content: z.string().min(1, t('posts.errors.content_required')),
    status: z.enum(['draft', 'published', 'archived']),
    type: z.enum(['article', 'guide', 'comparison']).default('article'),
    featured_image_alt: z.string().optional(),
    featured_media_id: z.string().nullable().optional(),
    author: z.string().optional(),
    read_time: z.preprocess(
      (val) => (val === '' || val === undefined ? undefined : Number(val)),
      z.number().int().min(0).optional()
    ),
    published_at: z.string().nullable().optional(),
    comparison_intro: z.string().optional(),
    disclosure_shown: z.boolean().optional(),
    comparison_items: z.array(comparisonItemSchema(t)).optional(),
  });

export type PostFormValues = z.infer<ReturnType<typeof getPostFormSchema>>;
