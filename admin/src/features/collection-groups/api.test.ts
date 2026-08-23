import { describe, expect, it } from 'vitest';
import { normalizeCollectionGroupResponse, normalizeCollectionGroupsResponse } from './api';

const collectionGroup = {
  id: 4,
  name: 'Summer Picks',
  handle: 'summer-picks',
  collections_count: 0,
};

describe('collection group API normalization', () => {
  it('normalizes wrapped and unwrapped list responses', () => {
    expect(normalizeCollectionGroupsResponse({ data: [collectionGroup] })).toEqual([collectionGroup]);
    expect(normalizeCollectionGroupsResponse([collectionGroup])).toEqual([collectionGroup]);
  });

  it('normalizes wrapped and unwrapped item responses', () => {
    expect(normalizeCollectionGroupResponse({ data: collectionGroup })).toEqual(collectionGroup);
    expect(normalizeCollectionGroupResponse(collectionGroup)).toEqual(collectionGroup);
  });
});
