// The "no API" way to fill the SEO fields: build a prompt to paste into any chatbot, then read the JSON it answers with.
// The wording mirrors what the paid "Generate with AI" button sends (AiSeoGeneratorService::prompt in the backend),
// so an answer from a chatbot follows the same rules about claims.

export type SeoContentType = 'blog' | 'product';

export const SEO_JSON_KEYS = ['seo_title', 'focus_keyphrase', 'meta_description', 'social_title', 'social_description'] as const;
export type SeoJsonKey = (typeof SEO_JSON_KEYS)[number];
export type SeoJson = Record<SeoJsonKey, string>;

/** The most each field may hold; the form shows the same numbers in its character counters. */
export const SEO_LIMITS: Record<SeoJsonKey, number> = { seo_title: 60, focus_keyphrase: 50, meta_description: 160, social_title: 60, social_description: 200 };

const POSITIONING = 'PetPosture is a breed-focused product recommendation brand that helps dog owners narrow product choices based on how their dog is built, everyday challenges, practical fit, dimensions, materials, usability, cleaning, and access.\n\n'
  + 'Never make veterinary, clinical, injury-prevention, posture-correction, testing, or unsupported health claims. Never invent ratings, review counts, prices, test evidence, merchant availability, or numerical proof. Only use claims supported by the supplied content.';

const CONTENT_LIMIT = 3000;

/** Plain text of an HTML fragment (or of a plain string), whitespace collapsed. */
export function plainText(value: unknown): string {
  const raw = typeof value === 'string' ? value : value && typeof value === 'object' && 'en' in value ? String((value as { en?: string }).en ?? '') : '';
  if (raw === '') return '';

  const text = new DOMParser().parseFromString(raw, 'text/html').body.textContent ?? '';

  return text.replace(/\s+/g, ' ').trim();
}

export interface SeoPromptInput {
  contentType: SeoContentType;
  title: string;
  content: unknown;
  /** More lines to give the chatbot, e.g. a Pick's "Our take" and "Quick specs". */
  extras?: { label: string; value: unknown }[];
}

export function buildSeoPrompt({ contentType, title, content, extras = [] }: SeoPromptInput): string {
  const isProduct = contentType === 'product';
  const task = isProduct
    ? 'You are writing SEO metadata for a product detail page. Keep claims grounded in the supplied description, use purchase-intent keywords naturally, and never use clickbait or exaggerated benefits.'
    : 'You are writing SEO metadata for an editorial blog article. Keep claims accurate to the supplied content, keyword-relevant, and never clickbait or exaggerated.';
  const output = 'Answer with ONLY one JSON object: no markdown, no code fence, no commentary. It must have exactly these five keys, all strings, in American English:\n'
    + '{"seo_title": "", "focus_keyphrase": "", "meta_description": "", "social_title": "", "social_description": ""}\n'
    + `Limits: seo_title up to ${SEO_LIMITS.seo_title} characters; focus_keyphrase up to ${SEO_LIMITS.focus_keyphrase} characters (2 to 4 words); meta_description 120 to ${SEO_LIMITS.meta_description} characters; social_title up to ${SEO_LIMITS.social_title} characters; social_description up to ${SEO_LIMITS.social_description} characters.`;
  const body = plainText(content).slice(0, CONTENT_LIMIT);
  const parts = [POSITIONING, task, output, `${isProduct ? 'Product name' : 'Article title'}: ${title.trim()}`, `${isProduct ? 'Product description' : 'Article content'}:\n${body}`];

  for (const extra of extras) {
    const text = plainText(extra.value).slice(0, CONTENT_LIMIT);
    if (text !== '') parts.push(`${extra.label}:\n${text}`);
  }

  return parts.join('\n\n');
}

export type SeoJsonResult =
  | { ok: true; data: SeoJson; tooLong: SeoJsonKey[] }
  | { ok: false; error: 'empty' | 'invalid' | 'missing'; missing: SeoJsonKey[] };

/** Reads a chatbot's answer. It copes with a code fence or a sentence around the JSON, but never fills half of the fields. */
export function parseSeoJson(raw: string): SeoJsonResult {
  const text = raw.trim();
  if (text === '') return { ok: false, error: 'empty', missing: [] };

  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) return { ok: false, error: 'invalid', missing: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return { ok: false, error: 'invalid', missing: [] };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return { ok: false, error: 'invalid', missing: [] };

  const record = parsed as Record<string, unknown>;
  const clean = (value: unknown) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '');
  const missing = SEO_JSON_KEYS.filter((key) => clean(record[key]) === '');
  if (missing.length > 0) return { ok: false, error: 'missing', missing };

  const data = Object.fromEntries(SEO_JSON_KEYS.map((key) => [key, clean(record[key])])) as SeoJson;
  const tooLong = SEO_JSON_KEYS.filter((key) => data[key].length > SEO_LIMITS[key]);

  return { ok: true, data, tooLong };
}
