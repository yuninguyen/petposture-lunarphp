import { z } from 'zod';

export const postFormSchema = z.object({
  title: z.string().min(1, 'Tiêu đề không được để trống').max(255),
  content: z.string().min(1, 'Nội dung không được để trống'),
  blog_category_id: z.string().min(1, 'Vui lòng chọn chuyên mục'),
  status: z.enum(['draft', 'published']),
  featured_media_id: z.string().nullable(),
});

export type PostFormValues = z.infer<typeof postFormSchema>;
