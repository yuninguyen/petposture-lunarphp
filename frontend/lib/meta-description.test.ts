import { describe, expect, it } from 'vitest';
import { META_DESCRIPTION_MAX_LENGTH, firstMetaDescription, toMetaDescription } from './meta-description';

describe('toMetaDescription', () => {
  it('returns null for empty, whitespace-only and missing values', () => {
    expect(toMetaDescription(null)).toBeNull();
    expect(toMetaDescription(undefined)).toBeNull();
    expect(toMetaDescription('   ')).toBeNull();
    expect(toMetaDescription('<p> </p>')).toBeNull();
  });

  it('strips rich-text markup the admin editor saves and collapses whitespace', () => {
    expect(toMetaDescription('<p>Long-backed,\n  <strong>short-legged</strong> dogs.</p>')).toBe('Long-backed, short-legged dogs.');
  });

  it('decodes the entities a rich-text editor emits', () => {
    expect(toMetaDescription('<p>Ramps &amp; stairs&nbsp;for the dog&#39;s &quot;back&quot;</p>')).toBe('Ramps & stairs for the dog\'s "back"');
  });

  it('keeps text that already fits untouched', () => {
    const text = 'a'.repeat(META_DESCRIPTION_MAX_LENGTH);
    expect(toMetaDescription(text)).toBe(text);
  });

  it('cuts longer text on a word boundary and never exceeds the limit', () => {
    const text = 'Dachshunds are long-backed and short-legged, so furniture access, stairs and everyday movement are worth extra consideration when choosing gear for them, from ramps to supportive beds.';
    const result = toMetaDescription(text) as string;

    expect(result.length).toBeLessThanOrEqual(META_DESCRIPTION_MAX_LENGTH);
    expect(result.endsWith('…')).toBe(true);
    expect(text.startsWith(result.slice(0, -1))).toBe(true);
    expect(result.slice(0, -1).endsWith(' ')).toBe(false);
    expect(text[result.length - 1]).toBe(' ');
  });

  it('cuts a single very long word at the limit instead of returning nothing', () => {
    const result = toMetaDescription('x'.repeat(400)) as string;

    expect(result).toHaveLength(META_DESCRIPTION_MAX_LENGTH);
    expect(result.endsWith('…')).toBe(true);
  });
});

describe('firstMetaDescription', () => {
  it('prefers the first candidate that has real text', () => {
    expect(firstMetaDescription([null, '  ', '<p>From the editorial copy.</p>', 'From the generic text.'], 'fallback'))
      .toBe('From the editorial copy.');
  });

  it('lets an admin-written SEO description win over editorial and generic text', () => {
    expect(firstMetaDescription(['Written in the SEO field.', 'Editorial.', 'Generic.'], 'fallback')).toBe('Written in the SEO field.');
  });

  it('falls back when no candidate has text', () => {
    expect(firstMetaDescription([null, undefined, '<p></p>'], 'fallback text')).toBe('fallback text');
  });
});
