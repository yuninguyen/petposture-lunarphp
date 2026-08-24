import { describe, expect, it } from 'vitest';
import type { CollectionGroupTree, CollectionNode } from './api';
import {
  canDropSameLevel,
  collectDescendantIds,
  findNode,
  flattenParentOptions,
  insertNode,
  moveNode,
  removeNode,
  removeNodeFromGroups,
  reorderSameLevel,
  replaceNode,
} from './treeHelpers';

function node(id: number, groupId: number, parentId: number | null, children: CollectionNode[] = []): CollectionNode {
  return {
    id,
    collection_group_id: groupId,
    parent_id: parentId,
    name: { en: `Node ${id}`, vi: `Nút ${id}` },
    children_count: children.length,
    children,
  };
}

function fixture(): CollectionGroupTree[] {
  const deep = node(4, 1, 2);
  const child = node(2, 1, 1, [deep]);
  return [
    { id: 1, name: 'One', handle: 'one', collections: [node(1, 1, null, [child]), node(3, 1, null)] },
    { id: 2, name: 'Two', handle: 'two', collections: [node(5, 2, null), node(6, 2, null)] },
  ];
}

describe('tree helpers', () => {
  it('finds deeply nested nodes and returns null when missing', () => {
    expect(findNode(fixture()[0].collections, 4)?.id).toBe(4);
    expect(findNode(fixture()[0].collections, 99)).toBeNull();
  });

  it('collects descendants without including the source node', () => {
    const root = fixture()[0].collections[0];
    expect([...collectDescendantIds(root)]).toEqual([2, 4]);
  });

  it('removes a nested subtree immutably', () => {
    const original = fixture()[0].collections;
    const snapshot = structuredClone(original);
    const result = removeNode(original, 2);
    expect(result.removed?.children[0].id).toBe(4);
    expect(result.nodes[0].children).toEqual([]);
    expect(result.nodes[0].children_count).toBe(0);
    expect(original).toEqual(snapshot);
  });

  it('inserts at root and beneath a deep parent at a requested index', () => {
    const roots = fixture()[0].collections;
    const rootInserted = insertNode(roots, null, node(7, 1, null), 1);
    expect(rootInserted.map((item) => item.id)).toEqual([1, 7, 3]);
    const nested = insertNode(roots, 2, node(7, 1, null), 0);
    expect(findNode(nested, 2)?.children.map((item) => item.id)).toEqual([7, 4]);
    expect(findNode(nested, 7)?.parent_id).toBe(2);
  });

  it('does not insert duplicate or into a missing parent', () => {
    const roots = fixture()[0].collections;
    expect(insertNode(roots, null, node(1, 1, null))).toBe(roots);
    expect(insertNode(roots, 99, node(7, 1, null))).toBe(roots);
  });

  it('replaces a deep node without mutating unrelated roots', () => {
    const roots = fixture()[0].collections;
    const replacement = { ...findNode(roots, 4)!, name: { en: 'Changed', vi: 'Đổi' } };
    const next = replaceNode(roots, replacement);
    expect(findNode(next, 4)?.name.en).toBe('Changed');
    expect(next[1]).toBe(roots[1]);
  });

  it('reorders roots before and after while retaining other groups', () => {
    const groups = fixture();
    const after = reorderSameLevel(groups, 1, 3, 'after');
    expect(after[0].collections.map((item) => item.id)).toEqual([3, 1]);
    expect(after[1]).toBe(groups[1]);
    const before = reorderSameLevel(after, 1, 3, 'before');
    expect(before[0].collections.map((item) => item.id)).toEqual([1, 3]);
  });

  it('reorders children only within the same parent', () => {
    const groups = fixture();
    const withSibling = moveNode(groups, 3, 1, 1);
    const reordered = reorderSameLevel(withSibling, 3, 2, 'before');
    expect(findNode(reordered[0].collections, 1)?.children.map((item) => item.id)).toEqual([3, 2]);
    expect(reorderSameLevel(groups, 2, 3, 'before')).toBe(groups);
    expect(reorderSameLevel(groups, 1, 1, 'before')).toBe(groups);
  });

  it('moves a node to another parent in the same group', () => {
    const groups = fixture();
    const moved = moveNode(groups, 4, 1, 3);
    expect(findNode(moved[0].collections, 2)?.children).toEqual([]);
    expect(findNode(moved[0].collections, 3)?.children[0].id).toBe(4);
    expect(findNode(moved[0].collections, 4)?.parent_id).toBe(3);
  });

  it('makes a nested node root', () => {
    const moved = moveNode(fixture(), 2, 1, null);
    expect(moved[0].collections.map((item) => item.id)).toEqual([1, 3, 2]);
    expect(findNode(moved[0].collections, 2)?.parent_id).toBeNull();
  });

  it('moves a subtree across groups and recursively changes group and parent IDs', () => {
    const groups = fixture();
    groups[0].collections[0].children[0].children[0].parent_id = 999;
    const moved = moveNode(groups, 2, 2, 5);
    expect(findNode(moved[0].collections, 2)).toBeNull();
    expect(findNode(moved[1].collections, 2)?.collection_group_id).toBe(2);
    expect(findNode(moved[1].collections, 4)?.collection_group_id).toBe(2);
    expect(findNode(moved[1].collections, 2)?.parent_id).toBe(5);
    expect(findNode(moved[1].collections, 4)?.parent_id).toBe(2);
  });

  it('rejects self, descendant, missing source, and missing destination parent moves', () => {
    const groups = fixture();
    expect(moveNode(groups, 1, 1, 1)).toBe(groups);
    expect(moveNode(groups, 1, 1, 4)).toBe(groups);
    expect(moveNode(groups, 99, 1, null)).toBe(groups);
    expect(moveNode(groups, 1, 2, 99)).toBe(groups);
  });

  it('removes a leaf or subtree from grouped trees', () => {
    const groups = fixture();
    expect(findNode(removeNodeFromGroups(groups, 4)[0].collections, 4)).toBeNull();
    expect(findNode(removeNodeFromGroups(groups, 2)[0].collections, 4)).toBeNull();
    expect(removeNodeFromGroups(groups, 99)).toBe(groups);
  });

  it('builds parent options and excludes the moving node and descendants', () => {
    const groups = fixture();
    const source = findNode(groups[0].collections, 1)!;
    const excluded = collectDescendantIds(source);
    excluded.add(source.id);
    const options = flattenParentOptions(groups, excluded);
    expect(options.filter((option) => option.id === null).map((option) => option.groupId)).toEqual([1, 2]);
    expect(options.some((option) => [1, 2, 4].includes(option.id ?? -1))).toBe(false);
    expect(options.find((option) => option.id === 5)).toMatchObject({ groupId: 2, depth: 1 });
  });

  it('allows drops only between siblings', () => {
    const groups = fixture();
    expect(canDropSameLevel(groups, 1, 3)).toBe(true);
    expect(canDropSameLevel(groups, 2, 4)).toBe(false);
    expect(canDropSameLevel(groups, 1, 5)).toBe(false);
  });

  it('never mutates the original fixture during transforms', () => {
    const groups = fixture();
    const snapshot = structuredClone(groups);
    moveNode(groups, 2, 2, 5);
    reorderSameLevel(groups, 1, 3, 'after');
    removeNodeFromGroups(groups, 2);
    expect(groups).toEqual(snapshot);
  });
});
