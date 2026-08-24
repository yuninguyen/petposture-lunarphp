import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DotsVerticalIcon, PencilIcon, PlusIcon, TrashIcon } from '@/components/ui/icons';
import type { CollectionNode } from './api';

interface CollectionNodeActionsProps {
  node: CollectionNode;
  disabled?: boolean;
  onAddChild: (node: CollectionNode) => void;
  onEdit: (node: CollectionNode) => void;
  onMove: (node: CollectionNode) => void;
  onMakeRoot: (node: CollectionNode) => void;
  onDelete: (node: CollectionNode) => void;
}

export function CollectionNodeActions({
  node,
  disabled = false,
  onAddChild,
  onEdit,
  onMove,
  onMakeRoot,
  onDelete,
}: CollectionNodeActionsProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function closeOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    }
    function closeOnScroll(event: Event) {
      if (menuRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', closeOutside);
    window.addEventListener('scroll', closeOnScroll, true);
    return () => {
      document.removeEventListener('mousedown', closeOutside);
      window.removeEventListener('scroll', closeOnScroll, true);
    };
  }, [open]);

  function toggle(event: React.MouseEvent<HTMLButtonElement>) {
    if (!open) {
      const rect = event.currentTarget.getBoundingClientRect();
      setPosition({ top: rect.bottom + 4, left: rect.right });
    }
    setOpen((value) => !value);
  }

  function action(callback: (value: CollectionNode) => void) {
    setOpen(false);
    callback(node);
  }

  const itemClass = 'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50';

  return (
    <div ref={menuRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={toggle}
        aria-label={t('collections.actions.open', { defaultValue: 'Open collection actions' })}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
      >
        <DotsVerticalIcon />
      </button>
      {open && (
        <div className="fixed z-50 min-w-[180px] -translate-x-full rounded-lg border border-slate-200 bg-white py-1 shadow-lg" style={position}>
          <button type="button" className={`${itemClass} text-slate-700`} onClick={() => action(onAddChild)}>
            <PlusIcon className="h-4 w-4 text-slate-400" />
            {t('collections.actions.add_child', { defaultValue: 'Add child' })}
          </button>
          <button type="button" className={`${itemClass} text-slate-700`} onClick={() => action(onEdit)}>
            <PencilIcon className="h-4 w-4 text-slate-400" />
            {t('common.edit', { defaultValue: 'Edit' })}
          </button>
          <button type="button" className={`${itemClass} text-slate-700`} onClick={() => action(onMove)}>
            <span className="w-4 text-center text-slate-400">↪</span>
            {t('collections.actions.move', { defaultValue: 'Move…' })}
          </button>
          {node.parent_id !== null && (
            <button type="button" className={`${itemClass} text-slate-700`} onClick={() => action(onMakeRoot)}>
              <span className="w-4 text-center text-slate-400">↑</span>
              {t('collections.actions.make_root', { defaultValue: 'Make root' })}
            </button>
          )}
          <button type="button" className={`${itemClass} text-red-600 hover:bg-red-50`} onClick={() => action(onDelete)}>
            <TrashIcon className="h-4 w-4 text-red-400" />
            {t('common.delete', { defaultValue: 'Delete' })}
          </button>
        </div>
      )}
    </div>
  );
}
