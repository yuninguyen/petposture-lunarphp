import { describe, expect, it } from 'vitest';
import {
  PIN_DESCRIPTION_MAX,
  PIN_TITLE_MAX,
  PinFormValues,
  buildPinPayload,
  charCount,
  isTwoByThree,
  pinFormSchema,
} from './pinSchema';

const valid: PinFormValues = {
  mediaId: '12',
  postId: '5',
  title: 'Does your Frenchie eat too fast?',
  description: 'A tilted bowl can help a flat-faced dog eat without bending its neck.',
  destinationUrl: 'https://petposture.com/blog/tilted-bowl-vs-slow-feeder',
  board: 'French Bulldog Tips',
  status: 'ready',
  scheduledDate: '2026-11-25',
};

const errorOf = (values: Partial<PinFormValues>, path: string) => {
  const result = pinFormSchema.safeParse({ ...valid, ...values });
  return result.success ? null : result.error.issues.find((issue) => issue.path.join('.') === path)?.message ?? null;
};

describe('pin form limits', () => {
  it('accepts a title of exactly 100 characters and a description of exactly 500', () => {
    expect(PIN_TITLE_MAX).toBe(100);
    expect(PIN_DESCRIPTION_MAX).toBe(500);
    expect(pinFormSchema.safeParse({ ...valid, title: 't'.repeat(100), description: 'd'.repeat(500) }).success).toBe(true);
  });

  it('rejects a title over 100 characters and a description over 500', () => {
    expect(errorOf({ title: 't'.repeat(101) }, 'title')).toBe('pinterest_pins.validation.title_max');
    expect(errorOf({ description: 'd'.repeat(501) }, 'description')).toBe('pinterest_pins.validation.description_max');
  });

  it('counts characters like the server does, so an emoji is one character and not two', () => {
    expect(charCount('abc')).toBe(3);
    expect(charCount('🐶'.repeat(100))).toBe(100);
    expect(pinFormSchema.safeParse({ ...valid, title: '🐶'.repeat(100) }).success).toBe(true);
    expect(errorOf({ title: '🐶'.repeat(101) }, 'title')).toBe('pinterest_pins.validation.title_max');
  });

  it('does not count the spaces around the text', () => {
    expect(pinFormSchema.safeParse({ ...valid, title: `  ${'t'.repeat(100)}  ` }).success).toBe(true);
  });
});

describe('pin form required fields', () => {
  it('needs an image, a title, a description and a link', () => {
    expect(errorOf({ mediaId: '' }, 'mediaId')).toBe('pinterest_pins.validation.image_required');
    expect(errorOf({ title: '   ' }, 'title')).toBe('pinterest_pins.validation.title_required');
    expect(errorOf({ description: '' }, 'description')).toBe('pinterest_pins.validation.description_required');
    expect(errorOf({ destinationUrl: '' }, 'destinationUrl')).toBe('pinterest_pins.validation.url_required');
  });

  it('needs the link to be a web address', () => {
    expect(errorOf({ destinationUrl: 'not a url' }, 'destinationUrl')).toBe('pinterest_pins.validation.url_invalid');
    expect(errorOf({ destinationUrl: 'ftp://petposture.com/x' }, 'destinationUrl')).toBe('pinterest_pins.validation.url_invalid');
    expect(pinFormSchema.safeParse({ ...valid, destinationUrl: 'https://petposture.com/picks/necoichi-tilted-elevated-bowl' }).success).toBe(true);
  });

  it('lets the post, board and schedule stay empty', () => {
    expect(pinFormSchema.safeParse({ ...valid, postId: '', board: '', scheduledDate: '' }).success).toBe(true);
  });

  it('takes a schedule only as a calendar date', () => {
    expect(errorOf({ scheduledDate: 'tomorrow' }, 'scheduledDate')).toBe('pinterest_pins.validation.date_invalid');
    expect(errorOf({ scheduledDate: '25/11/2026' }, 'scheduledDate')).toBe('pinterest_pins.validation.date_invalid');
  });

  it('takes only ready or posted as the status', () => {
    expect(pinFormSchema.safeParse({ ...valid, status: 'posted' }).success).toBe(true);
    expect(pinFormSchema.safeParse({ ...valid, status: 'draft' }).success).toBe(false);
  });
});

describe('pin payload', () => {
  it('turns the form into what the API takes: numbers for ids, null for what was left empty, trimmed text', () => {
    expect(buildPinPayload({ ...valid, title: '  Title  ', board: '  Dog Feeding ' })).toEqual({
      media_id: 12,
      post_id: 5,
      title: 'Title',
      description: valid.description,
      destination_url: valid.destinationUrl,
      board: 'Dog Feeding',
      status: 'ready',
      scheduled_date: '2026-11-25',
    });
  });

  it('sends null for a pin without a post, board or schedule', () => {
    expect(buildPinPayload({ ...valid, postId: '', board: '   ', scheduledDate: '' })).toMatchObject({
      post_id: null,
      board: null,
      scheduled_date: null,
    });
  });
});

describe('pin image shape', () => {
  it('knows a 2:3 image, such as 1000 x 1500, and allows a small rounding difference', () => {
    expect(isTwoByThree(1000, 1500)).toBe(true);
    expect(isTwoByThree(1000, 1499)).toBe(true);
    expect(isTwoByThree(600, 900)).toBe(true);
  });

  it('flags a square or wide image', () => {
    expect(isTwoByThree(1000, 1000)).toBe(false);
    expect(isTwoByThree(1500, 1000)).toBe(false);
  });

  it('says nothing when the size is not known', () => {
    expect(isTwoByThree(null, null)).toBe(true);
    expect(isTwoByThree(1000, 0)).toBe(true);
  });
});
