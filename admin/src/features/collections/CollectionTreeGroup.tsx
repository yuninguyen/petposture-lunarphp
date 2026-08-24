import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { PlusIcon } from '@/components/ui/icons';
import type { CollectionGroupTree, CollectionNode, ReorderCollectionPayload } from './api';
import { CollectionNodeRow } from './CollectionNodeRow';

interface CollectionTreeGroupProps {
  group: CollectionGroupTree;
  groups: CollectionGroupTree[];
  collapsed: boolean;
  expandedIds: Set<number>;
  affectedIds: Set<number>;
  draggedNodeId: number | null;
  onToggleGroup: (id: number) => void;
  onAddRoot: (group: CollectionGroupTree) => void;
  onToggleNode: (id: number) => void;
  onDragStart: (id: number) => void;
  onDragEnd: () => void;
  onReorder: (id: number, payload: ReorderCollectionPayload) => void;
  onAddChild: (node: CollectionNode) => void;
  onEdit: (node: CollectionNode) => void;
  onMove: (node: CollectionNode) => void;
  onMakeRoot: (node: CollectionNode) => void;
  onDelete: (node: CollectionNode) => void;
}

export function CollectionTreeGroup({
  group,
  groups,
  collapsed,
  expandedIds,
  affectedIds,
  draggedNodeId,
  onToggleGroup,
  onAddRoot,
  onToggleNode,
  onDragStart,
  onDragEnd,
  onReorder,
  onAddChild,
  onEdit,
  onMove,
  onMakeRoot,
  onDelete,
}: CollectionTreeGroupProps) {
  const { t } = useTranslation();
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 bg-slate-50 px-4 py-3">
        <button type="button" onClick={() => onToggleGroup(group.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className={`text-lg text-slate-500 transition-transform ${collapsed ? '' : 'rotate-90'}`}>›</span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-slate-900">{group.name}</span>
            <span className="block truncate font-mono text-xs text-slate-500">{group.handle}</span>
          </span>
          <span className="ml-auto rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">{group.collections.length}</span>
        </button>
        <Button type="button" variant="primary" className="shrink-0 px-3 py-1.5" onClick={() => onAddRoot(group)}>
          <PlusIcon />
          <span className="hidden sm:inline">{t('collections.add_root', { defaultValue: 'Add root' })}</span>
        </Button>
      </div>
      {!collapsed && (
        <div>
          {group.collections.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">{t('collections.group_empty', { defaultValue: 'No collections in this group.' })}</div>
          ) : group.collections.map((node) => (
            <CollectionNodeRow
              key={node.id}
              node={node}
              groups={groups}
              expandedIds={expandedIds}
              affectedIds={affectedIds}
              draggedNodeId={draggedNodeId}
              onToggle={onToggleNode}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onReorder={onReorder}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onMove={onMove}
              onMakeRoot={onMakeRoot}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </section>
  );
}
