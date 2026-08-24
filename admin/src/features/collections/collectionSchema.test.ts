import { describe, expect, it } from 'vitest';
import { buildCollectionFormData, collectionFormSchema } from './collectionSchema';

describe('collection form schema and payload', () => {
  it('requires, trims, and limits the collection name', () => {
    expect(collectionFormSchema.parse({ name: ' Bowls ' }).name).toBe('Bowls');
    expect(collectionFormSchema.safeParse({ name: ' ' }).success).toBe(false);
    expect(collectionFormSchema.safeParse({ name: 'x'.repeat(256) }).success).toBe(false);
  });

  it('mirrors one name into both locales and includes optional placement', () => {
    const data = buildCollectionFormData(
      { name: ' Bowls ' },
      { collectionGroupId: 2, parentId: 8 },
    );

    expect(data.get('name[en]')).toBe('Bowls');
    expect(data.get('name[vi]')).toBe('Bowls');
    expect(data.get('collection_group_id')).toBe('2');
    expect(data.get('parent_id')).toBe('8');
    expect(data.has('_method')).toBe(false);
  });

  it('omits a null root parent and adds the update method override', () => {
    const data = buildCollectionFormData(
      { name: 'Bowls' },
      { collectionGroupId: 2, parentId: null, isUpdate: true },
    );

    expect(data.has('parent_id')).toBe(false);
    expect(data.get('_method')).toBe('PUT');
  });
});
