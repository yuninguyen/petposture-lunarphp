import { useTranslation } from 'react-i18next';
import { useWatch, type Control } from 'react-hook-form';
import { ChecklistCard } from '@/components/ui/ChecklistCard';
import { postChecklist } from './postChecklist';

// Shown on a blog post's edit page. It reads what the form holds right now, so a line ticks as soon as it is filled.
export function PostChecklistCard({ control, hasFeaturedImage }: { control: Control<any>; hasFeaturedImage: boolean }) {
  const { t } = useTranslation();
  const seoTitle = (useWatch({ control, name: 'seo.title' }) ?? '') as string;
  const seoDescription = (useWatch({ control, name: 'seo.description' }) ?? '') as string;
  const featuredImageAlt = (useWatch({ control, name: 'featured_image_alt' }) ?? '') as string;
  const breeds = (useWatch({ control, name: 'breeds' }) ?? []) as unknown[];
  const solutions = (useWatch({ control, name: 'solutions' }) ?? []) as unknown[];
  const tags = (useWatch({ control, name: 'tags' }) ?? []) as unknown[];
  const status = (useWatch({ control, name: 'status' }) ?? 'draft') as 'draft' | 'published' | 'scheduled' | 'archived';
  const publishedAt = (useWatch({ control, name: 'published_at' }) ?? '') as string;
  const items = postChecklist({ seoTitle, seoDescription, hasFeaturedImage, featuredImageAlt, breedCount: breeds.length, solutionCount: solutions.length, tagCount: tags.length, status, publishedAt });

  return <ChecklistCard testId="post-checklist" title={t('posts.checklist.title')} hint={t('posts.checklist.hint')} labelPrefix="posts.checklist.items" items={items} />;
}
