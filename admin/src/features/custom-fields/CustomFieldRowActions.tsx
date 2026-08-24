import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CustomField } from './api';
import { PencilIcon, TrashIcon, DotsVerticalIcon } from '@/components/ui/icons';

interface CustomFieldRowActionsProps {
  field: CustomField;
  onEdit: (field: CustomField) => void;
  onDelete: (field: CustomField) => void;
}

export function CustomFieldRowActions({ field, onEdit, onDelete }: CustomFieldRowActionsProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const toggleMenu = (e: React.MouseEvent) => {
    if (!open) {
      const rect = e.currentTarget.getBoundingClientRect();
      setPosition({ top: rect.bottom, left: rect.right });
    }
    setOpen((value) => !value);
  };

  useEffect(() => {
    if (!open) return;
    
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    
    function handleScroll(e: Event) {
      if (menuRef.current && menuRef.current.contains(e.target as Node)) return;
      setOpen(false);
    }

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [open]);

  return (
    <div className="flex items-center justify-end gap-1">
      <div className="" ref={menuRef}>
        <button
          type="button"
          onClick={toggleMenu}
          className="inline-flex items-center justify-center rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          <DotsVerticalIcon />
        </button>

        {open && (
          <div 
            className="fixed z-50 mt-1 min-w-[160px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg -translate-x-full"
            style={{ top: position.top, left: position.left }}
          >
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onEdit(field);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <PencilIcon className="h-4 w-4 text-slate-400" />
              {t('common.edit', 'Edit')}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onDelete(field);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <TrashIcon className="h-4 w-4 text-red-400" />
              {t('common.delete', 'Delete')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
