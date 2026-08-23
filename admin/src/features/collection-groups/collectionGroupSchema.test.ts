import { describe, expect, it } from 'vitest';
import {
  applyCollectionGroupNameChange,
  buildCollectionGroupPayload,
  collectionGroupFormSchema,
  generateCollectionGroupHandle,
} from './collectionGroupSchema';

const values = { name: '', handle: '' };

describe('collection group form behavior', () => {
  it('accepts a flat English name and trims it', () => {
    expect(collectionGroupFormSchema.parse({ name: ' Summer Picks ', handle: 'summer-picks' })).toEqual({
      name: 'Summer Picks',
      handle: 'summer-picks',
    });
  });

  it('requires trimmed fields but permits manually entered non-slug handles', () => {
    expect(collectionGroupFormSchema.safeParse({ name: ' ', handle: 'valid-handle' }).success).toBe(false);
    expect(collectionGroupFormSchema.safeParse({ name: 'Valid', handle: ' ' }).success).toBe(false);
    expect(collectionGroupFormSchema.parse({ name: 'Valid', handle: ' Manual Handle_01 ' }).handle).toBe('Manual Handle_01');
  });

  it('generates a slug from punctuation and Unicode diacritics', () => {
    expect(generateCollectionGroupHandle('  Chăm Sóc & Đồ Chơi!  ')).toBe('cham-soc-do-choi');
    expect(generateCollectionGroupHandle('Crème ﬁne — Đẹp')).toBe('creme-fine-dep');
  });

  it('keeps a manual create handle override when the name changes later', () => {
    const manuallyOverridden = { name: 'First Name', handle: 'custom-handle' };
    expect(applyCollectionGroupNameChange(manuallyOverridden, 'Second Name', false, true)).toEqual({
      name: 'Second Name',
      handle: 'custom-handle',
    });
  });

  it('preserves the existing handle on edit name changes', () => {
    const existing = { name: 'Old Name', handle: 'existing-handle' };
    expect(applyCollectionGroupNameChange(existing, 'New Name', true, false)).toEqual({
      name: 'New Name',
      handle: 'existing-handle',
    });
  });

  it('auto-generates the handle for untouched create forms', () => {
    expect(applyCollectionGroupNameChange(values, 'Summer Picks', false, false)).toEqual({
      name: 'Summer Picks',
      handle: 'summer-picks',
    });
  });

  it('builds a trimmed name and handle payload', () => {
    expect(buildCollectionGroupPayload({ name: ' Summer Picks ', handle: ' summer-picks ' })).toEqual({
      name: 'Summer Picks',
      handle: 'summer-picks',
    });
  });
});
