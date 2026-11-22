import type { ChecklistItem } from '@/lib/checklist';
import { isFutureEasternInput } from '@/lib/easternTime';

// A checklist, not a score: it reads what the post form holds right now and says what is missing.

export const SEO_TITLE_MAX = 60;
export const META_DESCRIPTION_MIN = 120;
export const META_DESCRIPTION_MAX = 160;

export interface PostChecklistInput {
  seoTitle: string;
  seoDescription: string;
  hasFeaturedImage: boolean;
  featuredImageAlt: string;
  breedCount: number;
  solutionCount: number;
  tagCount: number;
  status: 'draft' | 'published' | 'scheduled' | 'archived';
  /** The publish time as typed in the form: US Eastern wall time, "YYYY-MM-DDTHH:mm", or "". */
  publishedAt: string;
  now?: number;
}

const readout = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

/** "Nov 21, 2026, 10:47 AM" for "2026-11-21T10:47" typed as Eastern wall time, or "" when it is empty or not a date-time. */
export function easternReadout(input: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(input ?? '');
  if (!match) return '';

  const [year, month, day, hour, minute] = match.slice(1).map(Number);

  return readout.format(new Date(Date.UTC(year, month - 1, day, hour, minute)));
}

export function postChecklist(input: PostChecklistInput): ChecklistItem[] {
  const items: ChecklistItem[] = [];

  const titleLength = input.seoTitle.trim().length;
  items.push(titleLength === 0
    ? { id: 'seo_title', status: 'missing', detail: 'posts.checklist.detail.seo_title_missing' }
    : titleLength > SEO_TITLE_MAX
      ? { id: 'seo_title', status: 'warn', detail: 'posts.checklist.detail.seo_title_long', params: { count: titleLength } }
      : { id: 'seo_title', status: 'ok', detail: 'posts.checklist.detail.seo_title_ok', params: { count: titleLength } });

  const descriptionLength = input.seoDescription.trim().length;
  items.push(descriptionLength === 0
    ? { id: 'meta_description', status: 'missing', detail: 'posts.checklist.detail.description_missing' }
    : descriptionLength < META_DESCRIPTION_MIN
      ? { id: 'meta_description', status: 'warn', detail: 'posts.checklist.detail.description_short', params: { count: descriptionLength } }
      : descriptionLength > META_DESCRIPTION_MAX
        ? { id: 'meta_description', status: 'warn', detail: 'posts.checklist.detail.description_long', params: { count: descriptionLength } }
        : { id: 'meta_description', status: 'ok', detail: 'posts.checklist.detail.description_ok', params: { count: descriptionLength } });

  items.push(!input.hasFeaturedImage
    ? { id: 'featured_image', status: 'missing', detail: 'posts.checklist.detail.image_missing' }
    : input.featuredImageAlt.trim() === ''
      ? { id: 'featured_image', status: 'missing', detail: 'posts.checklist.detail.image_alt_missing' }
      : { id: 'featured_image', status: 'ok', detail: 'posts.checklist.detail.image_ok' });

  items.push(input.breedCount + input.solutionCount === 0
    ? { id: 'tags', status: 'missing', detail: 'posts.checklist.detail.tags_missing' }
    : { id: 'tags', status: 'ok', detail: 'posts.checklist.detail.tags_ok', params: { breeds: input.breedCount, solutions: input.solutionCount, tags: input.tagCount } });

  // Only a scheduled post has a time that matters; a draft or a published post is not waiting for one.
  if (input.status === 'scheduled') {
    const time = `${easternReadout(input.publishedAt)} ET`;
    items.push(input.publishedAt.trim() === ''
      ? { id: 'schedule', status: 'missing', detail: 'posts.checklist.detail.schedule_missing' }
      : isFutureEasternInput(input.publishedAt, input.now)
        ? { id: 'schedule', status: 'ok', detail: 'posts.checklist.detail.schedule_ok', params: { time } }
        : { id: 'schedule', status: 'warn', detail: 'posts.checklist.detail.schedule_past', params: { time } });
  }

  return items;
}
