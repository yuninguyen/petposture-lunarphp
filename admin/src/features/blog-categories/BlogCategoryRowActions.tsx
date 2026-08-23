import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BlogCategory } from './api';
import { PencilIcon, TrashIcon, DotsVerticalIcon } from '@/components/ui/icons';

interface BlogCategoryRowActionsProps {
  category: BlogCategory;
  onEdit: (category: BlogCategory) => void;
  onDelete: (category: BlogCategory) => void;
}

export function BlogCategoryRowActions({ category, onEdit, onDelete }: BlogCategoryRowActionsProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="flex items-center justify-end gap-1">
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex items-center justify-center rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          <DotsVerticalIcon />
        </button>

        {open && (
          <div className="absolute right-0 z-10 mt-1 min-w-[160px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onEdit(category);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <PencilIcon className="h-4 w-4 text-slate-400" />
              {t('blog_categories.edit', 'Edit Category')}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onDelete(category);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <TrashIcon className="h-4 w-4 text-red-400" />
              {t('blog_categories.delete', 'Delete')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
