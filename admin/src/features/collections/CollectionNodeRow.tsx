import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CollectionGroupTree, CollectionNode, ReorderCollectionPayload } from './api';
import { canDropSameLevel } from './treeHelpers';
import { CollectionNodeActions } from './CollectionNodeActions';

interface CollectionNodeRowProps {
  node: CollectionNode;
  groups: CollectionGroupTree[];
  depth?: number;
  expandedIds: Set<number>;
  affectedIds: Set<number>;
  draggedNodeId: number | null;
  onToggle: (id: number) => void;
  onDragStart: (id: number) => void;
  onDragEnd: () => void;
  onReorder: (id: number, payload: ReorderCollectionPayload) => void;
  onAddChild: (node: CollectionNode) => void;
  onEdit: (node: CollectionNode) => void;
  onMove: (node: CollectionNode) => void;
  onMakeRoot: (node: CollectionNode) => void;
  onDelete: (node: CollectionNode) => void;
}

export function CollectionNodeRow({
  node,
  groups,
  depth = 0,
  expandedIds,
  affectedIds,
  draggedNodeId,
  onToggle,
  onDragStart,
  onDragEnd,
  onReorder,
  onAddChild,
  onEdit,
  onMove,
  onMakeRoot,
  onDelete,
}: CollectionNodeRowProps) {
  const { t } = useTranslation();
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(null);
  const expanded = expandedIds.has(node.id);
  const hasChildren = node.children_count > 0 || node.children.length > 0;
  const disabled = affectedIds.has(node.id);
  const validDrop = draggedNodeId !== null && canDropSameLevel(groups, draggedNodeId, node.id);

  return (
    <div>
      <div
        className={`relative flex min-h-14 items-center gap-2 border-b border-slate-100 px-3 py-2 transition-colors hover:bg-slate-50 ${disabled ? 'opacity-60' : ''}`}
        style={{ paddingLeft: `${12 + depth * 28}px` }}
        onDragOver={(event) => {
          if (!validDrop) return;
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          setDropPosition(event.clientY < rect.top + rect.height / 2 ? 'before' : 'after');
        }}
        onDragLeave={() => setDropPosition(null)}
        onDrop={(event) => {
          event.preventDefault();
          if (validDrop && draggedNodeId !== null && dropPosition) {
            onReorder(draggedNodeId, { sibling_id: node.id, position: dropPosition });
          }
          setDropPosition(null);
          onDragEnd();
        }}
      >
        {dropPosition && <div className={`absolute left-3 right-3 h-0.5 bg-secondary ${dropPosition === 'before' ? 'top-0' : 'bottom-0'}`} />}
        <button
          type="button"
          draggable={!disabled}
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', String(node.id));
            onDragStart(node.id);
          }}
          onDragEnd={() => { setDropPosition(null); onDragEnd(); }}
          disabled={disabled}
          className="cursor-grab select-none rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing disabled:cursor-default"
          aria-label={t('collections.drag_handle', { defaultValue: 'Drag to reorder' })}
          title={t('collections.drag_handle', { defaultValue: 'Drag to reorder' })}
        >
          ⠿
        </button>
        <button
          type="button"
          onClick={() => hasChildren && onToggle(node.id)}
          disabled={!hasChildren}
          className="flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 disabled:text-slate-300"
          aria-label={expanded ? t('collections.collapse', { defaultValue: 'Collapse' }) : t('collections.expand', { defaultValue: 'Expand' })}
        >
          {hasChildren ? <span className={`transition-transform ${expanded ? 'rotate-90' : ''}`}>›</span> : <span>·</span>}
        </button>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{node.name.en}</p>
        {hasChildren && <span className="hidden rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 sm:inline">{node.children_count}</span>}
        {disabled && <span className="h-4 w-4 animate-spin rounded-full border-2 border-secondary border-t-transparent" />}
        <CollectionNodeActions node={node} disabled={disabled} onAddChild={onAddChild} onEdit={onEdit} onMove={onMove} onMakeRoot={onMakeRoot} onDelete={onDelete} />
      </div>
      {expanded && node.children.map((child) => (
        <CollectionNodeRow
          key={child.id}
          node={child}
          groups={groups}
          depth={depth + 1}
          expandedIds={expandedIds}
          affectedIds={affectedIds}
          draggedNodeId={draggedNodeId}
          onToggle={onToggle}
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
  );
}
