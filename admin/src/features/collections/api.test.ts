import { describe, expect, it, vi } from 'vitest';
import { fetchJson } from '@/lib/api';
import {
  normalizeCollectionResponse,
  normalizeCollectionTreesResponse,
  updateCollection,
  type CollectionGroupTree,
  type CollectionNode,
} from './api';

vi.mock('@/lib/api', () => ({ fetchJson: vi.fn() }));

const node: CollectionNode = {
  id: 10,
  collection_group_id: 2,
  parent_id: null,
  name: { en: 'Bowls', vi: 'Bowls' },
  children_count: 0,
  children: [],
};

const group: CollectionGroupTree = {
  id: 2,
  name: 'Feeding',
  handle: 'feeding',
  collections: [node],
};

describe('collection API normalization', () => {
  it('normalizes wrapped and unwrapped grouped tree responses', () => {
    expect(normalizeCollectionTreesResponse([group])).toEqual([group]);
    expect(normalizeCollectionTreesResponse({ data: [group] })).toEqual([group]);
  });

  it('normalizes wrapped and unwrapped collection responses', () => {
    expect(normalizeCollectionResponse(node)).toEqual(node);
    expect(normalizeCollectionResponse({ data: node })).toEqual(node);
  });

  it('updates through multipart POST with a PUT method override', async () => {
    vi.mocked(fetchJson).mockResolvedValue({ data: node });
    const data = new FormData();
    data.append('name[en]', 'Bowls');
    data.append('name[vi]', 'Bowls');

    await updateCollection(node.id, data);

    expect(data.get('_method')).toBe('PUT');
    expect(fetchJson).toHaveBeenCalledWith('/admin/collections/10', { method: 'POST', body: data });
  });
});
