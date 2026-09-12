import { describe, expect, it } from 'vitest';
import en from './en.json';
import vi from './vi.json';

describe('post comparison locales', () => {
  it('provides exact comparison image alt text labels in en and vi', () => {
    expect((en as Record<string, string>)['posts.comparison.image_alt']).toBe('Image alt text');
    expect((vi as Record<string, string>)['posts.comparison.image_alt']).toBe('Văn bản thay thế hình ảnh');
  });

  it('provides comparison optional suffixes without embedded parentheses', () => {
    expect((en as Record<string, string>)['posts.comparison.optional_suffix']).toBe('optional');
    expect((vi as Record<string, string>)['posts.comparison.optional_suffix']).toBe('không bắt buộc');
  });

  it('composes exactly one pair of parentheses when wrapped by ComparisonItemRepeater', () => {
    const enSuffix = (en as Record<string, string>)['posts.comparison.optional_suffix'];
    const viSuffix = (vi as Record<string, string>)['posts.comparison.optional_suffix'];

    const composedEn = `(${enSuffix})`;
    const composedVi = `(${viSuffix})`;

    expect(composedEn).toBe('(optional)');
    expect(composedEn).not.toContain('((');
    expect(composedEn).not.toContain('))');

    expect(composedVi).toBe('(không bắt buộc)');
    expect(composedVi).not.toContain('((');
    expect(composedVi).not.toContain('))');
  });
});
