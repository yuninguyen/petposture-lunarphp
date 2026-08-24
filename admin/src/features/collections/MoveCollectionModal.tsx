import { FormEvent, useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { CollectionGroupTree, CollectionNode, MoveCollectionPayload } from './api';
import { collectDescendantIds, flattenParentOptions } from './treeHelpers';

interface MoveCollectionModalProps {
  open: boolean;
  node: CollectionNode | null;
  groups: CollectionGroupTree[];
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: (payload: MoveCollectionPayload) => void;
}

export function MoveCollectionModal({ open, node, groups, isLoading = false, onClose, onConfirm }: MoveCollectionModalProps) {
  const { t } = useTranslation();
  const [groupId, setGroupId] = useState(0);
  const [parentId, setParentId] = useState<number | null>(null);

  const excludedIds = useMemo(() => {
    if (!node) return new Set<number>();
    const ids = collectDescendantIds(node);
    ids.add(node.id);
    return ids;
  }, [node]);
  const options = useMemo(() => flattenParentOptions(groups, excludedIds), [excludedIds, groups]);
  const parentOptions = options.filter(
    (option): option is typeof option & { id: number } => option.groupId === groupId && option.id !== null,
  );

  useEffect(() => {
    if (!open || !node) return;
    setGroupId(node.collection_group_id);
    setParentId(node.parent_id);
  }, [node, open]);

  useEffect(() => {
    if (parentId !== null && !parentOptions.some((option) => option.id === parentId)) setParentId(null);
  }, [parentId, parentOptions]);

  const unchanged = Boolean(node && groupId === node.collection_group_id && parentId === node.parent_id);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (unchanged) return;
    onConfirm({ collection_group_id: groupId, parent_id: parentId });
  }

  if (!open || !node) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 p-4" onClick={() => !isLoading && onClose()}>
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{t('collections.move_title', { defaultValue: 'Move collection' })}</h2>
          <p className="mt-1 text-sm text-slate-500">{node.name.en}</p>
        </div>
        <form onSubmit={submit}>
          <div className="space-y-4 p-5">
            <div>
              <label htmlFor="move-group" className="mb-1 block text-sm font-medium text-slate-700">{t('collections.group', { defaultValue: 'Collection group' })}</label>
              <select id="move-group" value={groupId} onChange={(event) => { setGroupId(Number(event.target.value)); setParentId(null); }} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary">
                {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="move-parent" className="mb-1 block text-sm font-medium text-slate-700">{t('collections.parent', { defaultValue: 'Parent' })}</label>
              <select id="move-parent" value={parentId ?? ''} onChange={(event) => setParentId(event.target.value ? Number(event.target.value) : null)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary">
                <option value="">{t('collections.root_level', { defaultValue: 'Root level' })}</option>
                {parentOptions.map((option) => <option key={option.id} value={option.id}>{`${'— '.repeat(Math.max(0, option.depth - 1))}${option.label}`}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
            <Button type="button" variant="secondary" disabled={isLoading} onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit" variant="primary" disabled={isLoading || groupId === 0 || unchanged}>{isLoading ? t('common.saving') : t('collections.move', { defaultValue: 'Move' })}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
