import { describe, expect, it } from 'vitest';
import { buildSeoPrompt, parseSeoJson, plainText, SEO_LIMITS } from './seoPrompt';

const answer = { seo_title: 'Raised Dog Bowl | PetPosture', focus_keyphrase: 'raised dog bowl', meta_description: 'A raised bowl that keeps food and water at a comfortable height.', social_title: 'A raised bowl for dogs', social_description: 'See who this raised bowl suits and what to check first.' };

describe('plainText', () => {
  it('drops tags and entities and collapses whitespace', () => {
    expect(plainText('<p>Raised   ceramic&nbsp;bowl.</p>\n<ul><li>Non-slip</li></ul>')).toBe('Raised ceramic bowl. Non-slip');
  });

  it('reads the English side of a translated value and is empty for anything else', () => {
    expect(plainText({ en: '<p>Hello</p>', vi: 'Xin chào' })).toBe('Hello');
    expect(plainText(undefined)).toBe('');
    expect(plainText(null)).toBe('');
  });
});

describe('buildSeoPrompt', () => {
  it('asks for the five JSON keys with the same limits the form shows', () => {
    const prompt = buildSeoPrompt({ contentType: 'blog', title: 'Dog Ramp Guide', content: '<p>How to choose a ramp.</p>' });

    for (const key of ['seo_title', 'focus_keyphrase', 'meta_description', 'social_title', 'social_description']) expect(prompt).toContain(`"${key}"`);
    expect(prompt).toContain(`seo_title up to ${SEO_LIMITS.seo_title} characters`);
    expect(prompt).toContain('meta_description 120 to 160 characters');
    expect(prompt).toContain('ONLY one JSON object');
  });

  it('carries the rules about claims that the paid button sends', () => {
    const prompt = buildSeoPrompt({ contentType: 'product', title: 'Posture Bowl', content: '<p>Raised ceramic bowl.</p>' });

    expect(prompt).toContain('Never invent ratings, review counts, prices, test evidence');
    expect(prompt).toContain('product detail page');
  });

  it('gives a blog article and a product different wording and labels', () => {
    const blog = buildSeoPrompt({ contentType: 'blog', title: 'Dog Ramp Guide', content: 'x' });
    const product = buildSeoPrompt({ contentType: 'product', title: 'Posture Bowl', content: 'x' });

    expect(blog).toContain('editorial blog article');
    expect(blog).toContain('Article title: Dog Ramp Guide');
    expect(product).toContain('Product name: Posture Bowl');
    expect(product).toContain('Product description:\nx');
  });

  it('gives a Pick, a post, a breed page and a solution page both rules, and a Shop product only the call-to-action one', () => {
    const noTesting = 'PetPosture does not test products itself';
    const noCallToAction = 'Never use a call to action or urgency';

    for (const contentType of ['pick', 'blog'] as const) {
      const prompt = buildSeoPrompt({ contentType, title: 'T', content: 'x' });

      expect(prompt).toContain(noTesting);
      expect(prompt).toContain('do not use "we tested", "our review", "hands-on" or "we tried"');
      expect(prompt).toContain(noCallToAction);
      expect(prompt).toContain('never start a sentence with "Read our"');
    }

    const shop = buildSeoPrompt({ contentType: 'product', title: 'T', content: 'x' });
    expect(shop).toContain(noCallToAction);
    expect(shop).not.toContain(noTesting);
  });

  it('words a Pick like a product page and a post like an article', () => {
    expect(buildSeoPrompt({ contentType: 'pick', title: 'T', content: 'x' })).toContain('Product name: T');
    expect(buildSeoPrompt({ contentType: 'pick', title: 'T', content: 'x' })).toContain('product detail page');
    expect(buildSeoPrompt({ contentType: 'blog', title: 'T', content: 'x' })).toContain('Article title: T');
  });

  it('sends plain text only and stops the content at 3000 characters', () => {
    const prompt = buildSeoPrompt({ contentType: 'blog', title: 'T', content: `<p>${'a'.repeat(5000)}</p>` });

    expect(prompt).not.toContain('<p>');
    const longest = Math.max(...(prompt.match(/a{50,}/g) ?? []).map((run) => run.length));
    expect(longest).toBe(3000);
  });

  it("adds a Pick's extra lines when they have text, and skips the empty ones", () => {
    const prompt = buildSeoPrompt({ contentType: 'product', title: 'Bowl', content: 'desc', extras: [{ label: 'Our take', value: 'Based on the seller description.' }, { label: 'Quick specs', value: '' }] });

    expect(prompt).toContain('Our take:\nBased on the seller description.');
    expect(prompt).not.toContain('Quick specs');
  });
});

describe('parseSeoJson', () => {
  it('reads a plain JSON answer', () => {
    const result = parseSeoJson(JSON.stringify(answer));

    expect(result).toEqual({ ok: true, data: answer, tooLong: [] });
  });

  it('copes with a code fence and with a sentence around the JSON', () => {
    expect(parseSeoJson('```json\n' + JSON.stringify(answer) + '\n```')).toMatchObject({ ok: true, data: answer });
    expect(parseSeoJson('Here you go:\n' + JSON.stringify(answer) + '\nHope that helps!')).toMatchObject({ ok: true, data: answer });
  });

  it('trims and collapses the whitespace inside every value', () => {
    const result = parseSeoJson(JSON.stringify({ ...answer, seo_title: '  Raised   Dog Bowl \n' }));

    expect(result).toMatchObject({ ok: true, data: { seo_title: 'Raised Dog Bowl' } });
  });

  it('refuses an empty box, text that is not JSON, and JSON that is not an object', () => {
    expect(parseSeoJson('   ')).toMatchObject({ ok: false, error: 'empty' });
    expect(parseSeoJson('just some words')).toMatchObject({ ok: false, error: 'invalid' });
    expect(parseSeoJson('{"seo_title": "cut off')).toMatchObject({ ok: false, error: 'invalid' });
    expect(parseSeoJson('[1, 2]')).toMatchObject({ ok: false, error: 'invalid' });
  });

  it('names the keys that are missing, empty or not text, and fills none of them', () => {
    const { seo_title: _drop, ...rest } = answer;
    const result = parseSeoJson(JSON.stringify({ ...rest, focus_keyphrase: '', meta_description: 42 }));

    expect(result).toEqual({ ok: false, error: 'missing', missing: ['seo_title', 'focus_keyphrase', 'meta_description'] });
  });

  it('still returns the answer when a field is over its limit, and says which one', () => {
    const result = parseSeoJson(JSON.stringify({ ...answer, seo_title: 'x'.repeat(61), social_description: 'y'.repeat(201) }));

    expect(result).toMatchObject({ ok: true, tooLong: ['seo_title', 'social_description'] });
  });
});
