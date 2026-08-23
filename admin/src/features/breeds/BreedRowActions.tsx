import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { Breed } from './breedsApi';
import { PencilIcon, TrashIcon, DotsVerticalIcon } from '@/components/ui/icons';

interface BreedRowActionsProps {
  breed: Breed;
  onDelete: (breed: Breed) => void;
  onView: (breed: Breed) => void;
}

export function BreedRowActions({ breed, onDelete, onView }: BreedRowActionsProps) {
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
      <button
        type="button"
        onClick={() => onView(breed)}
        className="inline-flex items-center justify-center rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-primary transition-colors"
        title={t('common.view', 'View')}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      </button>

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
            <Link
              to={`/breeds/${breed.id}`}
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <PencilIcon className="h-4 w-4 text-slate-400" />
              {t('common.edit', 'Edit')}
            </Link>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onDelete(breed);
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
