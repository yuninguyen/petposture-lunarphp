import type { CollectionGroupTree, CollectionNode } from './api';

export interface NodeLocation {
  node: CollectionNode;
  groupId: number;
  parentId: number | null;
  index: number;
}

export interface ParentOption {
  id: number | null;
  groupId: number;
  depth: number;
  label: string;
}

export function findNode(nodes: CollectionNode[], id: number): CollectionNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const child = findNode(node.children, id);
    if (child) return child;
  }
  return null;
}

export function findNodeLocation(groups: CollectionGroupTree[], id: number): NodeLocation | null {
  function visit(nodes: CollectionNode[], groupId: number, parentId: number | null): NodeLocation | null {
    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index];
      if (node.id === id) return { node, groupId, parentId, index };
      const child = visit(node.children, groupId, node.id);
      if (child) return child;
    }
    return null;
  }

  for (const group of groups) {
    const location = visit(group.collections, group.id, null);
    if (location) return location;
  }
  return null;
}

export function collectDescendantIds(node: CollectionNode): Set<number> {
  const ids = new Set<number>();
  function visit(children: CollectionNode[]) {
    children.forEach((child) => {
      ids.add(child.id);
      visit(child.children);
    });
  }
  visit(node.children);
  return ids;
}

export function removeNode(
  nodes: CollectionNode[],
  id: number,
): { nodes: CollectionNode[]; removed: CollectionNode | null } {
  const directIndex = nodes.findIndex((node) => node.id === id);
  if (directIndex >= 0) {
    return {
      nodes: [...nodes.slice(0, directIndex), ...nodes.slice(directIndex + 1)],
      removed: nodes[directIndex],
    };
  }

  for (let index = 0; index < nodes.length; index += 1) {
    const result = removeNode(nodes[index].children, id);
    if (result.removed) {
      const next = [...nodes];
      next[index] = {
        ...nodes[index],
        children: result.nodes,
        children_count: result.nodes.length,
      };
      return { nodes: next, removed: result.removed };
    }
  }

  return { nodes, removed: null };
}

export function insertNode(
  nodes: CollectionNode[],
  parentId: number | null,
  node: CollectionNode,
  index?: number,
): CollectionNode[] {
  if (findNode(nodes, node.id)) return nodes;
  if (parentId === null) {
    const insertionIndex = Math.max(0, Math.min(index ?? nodes.length, nodes.length));
    return [...nodes.slice(0, insertionIndex), { ...node, parent_id: null }, ...nodes.slice(insertionIndex)];
  }

  let changed = false;
  const next = nodes.map((current) => {
    if (current.id === parentId) {
      const insertionIndex = Math.max(0, Math.min(index ?? current.children.length, current.children.length));
      changed = true;
      const children = [
        ...current.children.slice(0, insertionIndex),
        { ...node, parent_id: current.id },
        ...current.children.slice(insertionIndex),
      ];
      return { ...current, children, children_count: children.length };
    }
    const children = insertNode(current.children, parentId, node, index);
    if (children !== current.children) {
      changed = true;
      return { ...current, children, children_count: children.length };
    }
    return current;
  });
  return changed ? next : nodes;
}

export function replaceNode(nodes: CollectionNode[], replacement: CollectionNode): CollectionNode[] {
  let changed = false;
  const next = nodes.map((node) => {
    if (node.id === replacement.id) {
      changed = true;
      return replacement;
    }
    const children = replaceNode(node.children, replacement);
    if (children !== node.children) {
      changed = true;
      return { ...node, children, children_count: children.length };
    }
    return node;
  });
  return changed ? next : nodes;
}

function updateGroupIds(node: CollectionNode, groupId: number, parentId: number | null): CollectionNode {
  return {
    ...node,
    collection_group_id: groupId,
    parent_id: parentId,
    children: node.children.map((child) => updateGroupIds(child, groupId, node.id)),
  };
}

export function moveNode(
  groups: CollectionGroupTree[],
  nodeId: number,
  destinationGroupId: number,
  destinationParentId: number | null,
  destinationIndex?: number,
): CollectionGroupTree[] {
  const source = findNodeLocation(groups, nodeId);
  const destinationGroup = groups.find((group) => group.id === destinationGroupId);
  if (!source || !destinationGroup) return groups;
  if (source.groupId === destinationGroupId && source.parentId === destinationParentId) return groups;

  const forbidden = collectDescendantIds(source.node);
  if (destinationParentId === nodeId || (destinationParentId !== null && forbidden.has(destinationParentId))) return groups;
  if (destinationParentId !== null && !findNode(destinationGroup.collections, destinationParentId)) return groups;

  let removed: CollectionNode | null = null;
  let withoutSource = groups.map((group) => {
    if (group.id !== source.groupId) return group;
    const result = removeNode(group.collections, nodeId);
    removed = result.removed;
    return result.removed ? { ...group, collections: result.nodes } : group;
  });
  if (!removed) return groups;

  const moved = updateGroupIds(source.node, destinationGroupId, destinationParentId);
  withoutSource = withoutSource.map((group) => {
    if (group.id !== destinationGroupId) return group;
    const collections = insertNode(group.collections, destinationParentId, moved, destinationIndex);
    return collections === group.collections ? group : { ...group, collections };
  });
  return withoutSource;
}

export function reorderSameLevel(
  groups: CollectionGroupTree[],
  activeId: number,
  siblingId: number,
  position: 'before' | 'after',
): CollectionGroupTree[] {
  if (activeId === siblingId) return groups;
  const active = findNodeLocation(groups, activeId);
  const sibling = findNodeLocation(groups, siblingId);
  if (!active || !sibling || active.groupId !== sibling.groupId || active.parentId !== sibling.parentId) return groups;

  const siblings = active.parentId === null
    ? groups.find((group) => group.id === active.groupId)?.collections
    : findNode(groups.find((group) => group.id === active.groupId)?.collections ?? [], active.parentId)?.children;
  if (!siblings) return groups;

  const activeIndex = siblings.findIndex((node) => node.id === activeId);
  const siblingIndex = siblings.findIndex((node) => node.id === siblingId);
  const reordered = [...siblings];
  const [moving] = reordered.splice(activeIndex, 1);
  let targetIndex = siblingIndex + (position === 'after' ? 1 : 0);
  if (activeIndex < targetIndex) targetIndex -= 1;
  reordered.splice(targetIndex, 0, moving);
  if (reordered.every((node, index) => node === siblings[index])) return groups;

  return groups.map((group) => {
    if (group.id !== active.groupId) return group;
    if (active.parentId === null) return { ...group, collections: reordered };
    const parent = findNode(group.collections, active.parentId);
    if (!parent) return group;
    return { ...group, collections: replaceNode(group.collections, { ...parent, children: reordered }) };
  });
}

export function removeNodeFromGroups(groups: CollectionGroupTree[], nodeId: number): CollectionGroupTree[] {
  const location = findNodeLocation(groups, nodeId);
  if (!location) return groups;
  return groups.map((group) => {
    if (group.id !== location.groupId) return group;
    const result = removeNode(group.collections, nodeId);
    return result.removed ? { ...group, collections: result.nodes } : group;
  });
}

export function flattenParentOptions(
  groups: CollectionGroupTree[],
  excludedIds: Set<number> = new Set(),
): ParentOption[] {
  const options: ParentOption[] = [];
  groups.forEach((group) => {
    options.push({ id: null, groupId: group.id, depth: 0, label: group.name });
    function visit(nodes: CollectionNode[], depth: number) {
      nodes.forEach((node) => {
        if (excludedIds.has(node.id)) return;
        options.push({ id: node.id, groupId: group.id, depth, label: node.name.en || node.name.vi });
        visit(node.children, depth + 1);
      });
    }
    visit(group.collections, 1);
  });
  return options;
}

export function canDropSameLevel(groups: CollectionGroupTree[], activeId: number, siblingId: number): boolean {
  const active = findNodeLocation(groups, activeId);
  const sibling = findNodeLocation(groups, siblingId);
  return Boolean(active && sibling && active.node.id !== sibling.node.id
    && active.groupId === sibling.groupId && active.parentId === sibling.parentId);
}
