import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { DeleteConfirmModal } from '@/components/ui/delete-confirm-modal';
import {
  deleteCollection,
  fetchCollectionTrees,
  moveCollection,
  reorderCollection,
  type CollectionGroupTree,
  type CollectionNode,
  type MoveCollectionPayload,
  type ReorderCollectionPayload,
} from './api';
import { CollectionFormModal } from './CollectionFormModal';
import { CollectionTreeGroup } from './CollectionTreeGroup';
import { MoveCollectionModal } from './MoveCollectionModal';
import { moveNode, removeNodeFromGroups, reorderSameLevel } from './treeHelpers';

const collectionsTreeKey = ['collections', 'tree'] as const;

type FormTarget = {
  groupId: number;
  parentId: number | null;
  collection: CollectionNode | null;
} | null;

interface MutationContext {
  previous?: CollectionGroupTree[];
}

export function CollectionsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [openGroupIds, setOpenGroupIds] = useState<Set<number>>(new Set());
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<number>>(new Set());
  const [affectedNodeIds, setAffectedNodeIds] = useState<Set<number>>(new Set());
  const [draggedNodeId, setDraggedNodeId] = useState<number | null>(null);
  const [formTarget, setFormTarget] = useState<FormTarget>(null);
  const [moveTarget, setMoveTarget] = useState<CollectionNode | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CollectionNode | null>(null);

  const treeQuery = useQuery({ queryKey: collectionsTreeKey, queryFn: fetchCollectionTrees });
  const groups = treeQuery.data ?? [];

  function markAffected(id: number, affected: boolean) {
    setAffectedNodeIds((current) => {
      const next = new Set(current);
      if (affected) next.add(id); else next.delete(id);
      return next;
    });
  }

  const reorderMutation = useMutation<CollectionNode, Error, { id: number; payload: ReorderCollectionPayload }, MutationContext>({
    mutationFn: ({ id, payload }) => reorderCollection(id, payload),
    onMutate: async ({ id, payload }) => {
      markAffected(id, true);
      await queryClient.cancelQueries({ queryKey: collectionsTreeKey });
      const previous = queryClient.getQueryData<CollectionGroupTree[]>(collectionsTreeKey);
      queryClient.setQueryData<CollectionGroupTree[]>(collectionsTreeKey, (current) => current ? reorderSameLevel(current, id, payload.sibling_id, payload.position) : current);
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(collectionsTreeKey, context.previous);
      toast.error(error.message || t('collections.reorder_error', { defaultValue: 'Could not reorder collection.' }));
    },
    onSuccess: () => toast.success(t('collections.reorder_success', { defaultValue: 'Collection reordered.' })),
    onSettled: (_data, _error, variables) => {
      markAffected(variables.id, false);
      queryClient.invalidateQueries({ queryKey: collectionsTreeKey });
    },
  });

  const moveMutation = useMutation<CollectionNode, Error, { id: number; payload: MoveCollectionPayload }, MutationContext>({
    mutationFn: ({ id, payload }) => moveCollection(id, payload),
    onMutate: async ({ id, payload }) => {
      markAffected(id, true);
      await queryClient.cancelQueries({ queryKey: collectionsTreeKey });
      const previous = queryClient.getQueryData<CollectionGroupTree[]>(collectionsTreeKey);
      queryClient.setQueryData<CollectionGroupTree[]>(collectionsTreeKey, (current) => current ? moveNode(current, id, payload.collection_group_id, payload.parent_id) : current);
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(collectionsTreeKey, context.previous);
      toast.error(error.message || t('collections.move_error', { defaultValue: 'Could not move collection.' }));
    },
    onSuccess: (_saved, variables) => {
      setOpenGroupIds((current) => new Set(current).add(variables.payload.collection_group_id));
      if (variables.payload.parent_id !== null) {
        setExpandedNodeIds((current) => new Set(current).add(variables.payload.parent_id as number));
      }
      toast.success(t('collections.move_success', { defaultValue: 'Collection moved.' }));
      setMoveTarget(null);
    },
    onSettled: (_data, _error, variables) => {
      markAffected(variables.id, false);
      queryClient.invalidateQueries({ queryKey: collectionsTreeKey });
    },
  });

  const deleteMutation = useMutation<void, Error, CollectionNode, MutationContext>({
    mutationFn: (node) => deleteCollection(node.id),
    onMutate: async (node) => {
      markAffected(node.id, true);
      await queryClient.cancelQueries({ queryKey: collectionsTreeKey });
      const previous = queryClient.getQueryData<CollectionGroupTree[]>(collectionsTreeKey);
      if (node.children_count === 0 && node.children.length === 0) {
        queryClient.setQueryData<CollectionGroupTree[]>(collectionsTreeKey, (current) => current ? removeNodeFromGroups(current, node.id) : current);
      }
      return { previous };
    },
    onError: (error, _node, context) => {
      if (context?.previous) queryClient.setQueryData(collectionsTreeKey, context.previous);
      toast.error(error.message || t('collections.delete_error', { defaultValue: 'Could not delete collection.' }));
    },
    onSuccess: () => {
      toast.success(t('collections.delete_success', { defaultValue: 'Collection deleted.' }));
      setDeleteTarget(null);
    },
    onSettled: (_data, _error, node) => {
      markAffected(node.id, false);
      queryClient.invalidateQueries({ queryKey: collectionsTreeKey });
    },
  });

  function toggleSet(setter: React.Dispatch<React.SetStateAction<Set<number>>>, id: number) {
    setter((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function openAddRoot(group: CollectionGroupTree) {
    setOpenGroupIds((current) => new Set(current).add(group.id));
    setFormTarget({ groupId: group.id, parentId: null, collection: null });
  }

  function openAddChild(node: CollectionNode) {
    setOpenGroupIds((current) => new Set(current).add(node.collection_group_id));
    setExpandedNodeIds((current) => new Set(current).add(node.id));
    setFormTarget({ groupId: node.collection_group_id, parentId: node.id, collection: null });
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('collections.title', { defaultValue: 'Collections' })}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('collections.subtitle', { defaultValue: 'Organize bilingual collections into grouped trees.' })}</p>
      </div>

      {treeQuery.isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-500">
          <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-secondary border-t-transparent" />
          {t('common.loading')}
        </div>
      ) : treeQuery.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-8 text-center text-sm text-red-700">{treeQuery.error instanceof Error ? treeQuery.error.message : t('common.error_occurred', { defaultValue: 'Something went wrong.' })}</div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500">{t('collections.empty', { defaultValue: 'No collection groups found.' })}</div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <CollectionTreeGroup
              key={group.id}
              group={group}
              groups={groups}
              collapsed={!openGroupIds.has(group.id)}
              expandedIds={expandedNodeIds}
              affectedIds={affectedNodeIds}
              draggedNodeId={draggedNodeId}
              onToggleGroup={(id) => toggleSet(setOpenGroupIds, id)}
              onAddRoot={openAddRoot}
              onToggleNode={(id) => toggleSet(setExpandedNodeIds, id)}
              onDragStart={setDraggedNodeId}
              onDragEnd={() => setDraggedNodeId(null)}
              onReorder={(id, payload) => reorderMutation.mutate({ id, payload })}
              onAddChild={openAddChild}
              onEdit={(node) => setFormTarget({ groupId: node.collection_group_id, parentId: node.parent_id, collection: node })}
              onMove={setMoveTarget}
              onMakeRoot={(node) => moveMutation.mutate({ id: node.id, payload: { collection_group_id: node.collection_group_id, parent_id: null } })}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      <CollectionFormModal
        open={formTarget !== null}
        collectionGroupId={formTarget?.groupId ?? null}
        parentId={formTarget?.parentId ?? null}
        collection={formTarget?.collection ?? null}
        onClose={() => setFormTarget(null)}
      />
      <MoveCollectionModal
        open={moveTarget !== null}
        node={moveTarget}
        groups={groups}
        isLoading={moveMutation.isPending}
        onClose={() => setMoveTarget(null)}
        onConfirm={(payload) => moveTarget && moveMutation.mutate({ id: moveTarget.id, payload })}
      />
      <DeleteConfirmModal
        open={deleteTarget !== null}
        title={t('collections.delete_title', { defaultValue: 'Delete collection?' })}
        message={t('collections.delete_message', {
          name: deleteTarget?.name.en ?? '',
          defaultValue: `Delete “${deleteTarget?.name.en ?? ''}”? This cannot be undone.`,
        })}
        isLoading={deleteMutation.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
      />
    </div>
  );
}
