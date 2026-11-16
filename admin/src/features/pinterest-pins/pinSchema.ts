import { z } from 'zod';

export const PIN_TITLE_MAX = 100;
export const PIN_DESCRIPTION_MAX = 500;

/** What a person can set on a pin. */
export type PinStatus = 'ready' | 'posted';

/** Every state a pin can be in. The last three are set by the posting job, never chosen in the form. */
export type PinDisplayStatus = PinStatus | 'publishing' | 'failed' | 'needs_review';

export interface PinFormValues {
  /** Id of the media library entry chosen as the pin image; empty until one is chosen. */
  mediaId: string;
  /** Id of the post the pin comes from; empty when the pin is not tied to a post. */
  postId: string;
  title: string;
  description: string;
  destinationUrl: string;
  board: string;
  /** Id of the board on the connected Pinterest account; empty when the board is only typed text. */
  boardId: string;
  status: PinStatus;
  /** YYYY-MM-DD, or empty. */
  scheduledDate: string;
}

/** Characters as the server counts them: an emoji is one, not the two UTF-16 units `.length` would give it. */
export function charCount(value: string): number {
  return Array.from(value).length;
}

function isWebUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export const pinFormSchema = z.object({
  mediaId: z.string().min(1, 'pinterest_pins.validation.image_required'),
  postId: z.string(),
  title: z
    .string()
    .trim()
    .min(1, 'pinterest_pins.validation.title_required')
    .refine((value) => charCount(value) <= PIN_TITLE_MAX, 'pinterest_pins.validation.title_max'),
  description: z
    .string()
    .trim()
    .min(1, 'pinterest_pins.validation.description_required')
    .refine((value) => charCount(value) <= PIN_DESCRIPTION_MAX, 'pinterest_pins.validation.description_max'),
  destinationUrl: z
    .string()
    .trim()
    .min(1, 'pinterest_pins.validation.url_required')
    .refine(isWebUrl, 'pinterest_pins.validation.url_invalid'),
  board: z.string(),
  boardId: z.string(),
  status: z.enum(['ready', 'posted']),
  scheduledDate: z.string().refine((value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value), 'pinterest_pins.validation.date_invalid'),
});

/**
 * `omitStatus` leaves the status out of the payload, so saving edits to a pin the posting job is holding (failed,
 * or waiting for a person to check it) does not quietly put it back to ready.
 */
export function buildPinPayload(values: PinFormValues, omitStatus = false) {
  const payload = {
    media_id: Number(values.mediaId),
    post_id: values.postId ? Number(values.postId) : null,
    title: values.title.trim(),
    description: values.description.trim(),
    destination_url: values.destinationUrl.trim(),
    board: values.board.trim() || null,
    pinterest_board_id: values.boardId || null,
    status: values.status,
    scheduled_date: values.scheduledDate || null,
  };

  if (omitStatus) {
    const { status: _status, ...withoutStatus } = payload;
    return withoutStatus;
  }

  return payload;
}

/**
 * Pinterest shows pins best at 2:3 (1000 x 1500). A pin with another shape still works, so this only drives a
 * hint. An image whose size is not known is not flagged.
 */
export function isTwoByThree(width: number | null | undefined, height: number | null | undefined): boolean {
  if (!width || !height) return true;
  return Math.abs(width / height - 2 / 3) <= 0.01;
}
