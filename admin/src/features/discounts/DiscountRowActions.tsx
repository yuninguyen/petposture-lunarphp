import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Discount } from './api';
import { DotsVerticalIcon, PencilIcon, TrashIcon } from '@/components/ui/icons';

interface DiscountRowActionsProps {
  discount: Discount;
  onEdit: (discount: Discount) => void;
  onDelete: (discount: Discount) => void;
}

export function DiscountRowActions({ discount, onEdit, onDelete }: DiscountRowActionsProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  function toggleMenu(event: React.MouseEvent) {
    if (!open) {
      const rect = event.currentTarget.getBoundingClientRect();
      setPosition({ top: rect.bottom, left: rect.right });
    }
    setOpen((value) => !value);
  }

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    }

    function closeOnScroll(event: Event) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener('mousedown', closeOnOutsideClick);
    window.addEventListener('scroll', closeOnScroll, true);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      window.removeEventListener('scroll', closeOnScroll, true);
    };
  }, [open]);

  return (
    <div className="flex items-center justify-end">
      <div ref={menuRef}>
        <button type="button" aria-label={t('discounts.actions')} onClick={toggleMenu} className="inline-flex items-center justify-center rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors">
          <DotsVerticalIcon />
        </button>
        {open && <div className="fixed z-50 mt-1 min-w-[160px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg -translate-x-full" style={{ top: position.top, left: position.left }}>
          <button type="button" onClick={() => { setOpen(false); onEdit(discount); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors">
            <PencilIcon className="h-4 w-4 text-slate-400" />{t(discount.supported ? 'discounts.edit' : 'discounts.view')}
          </button>
          <button type="button" onClick={() => { setOpen(false); onDelete(discount); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors">
            <TrashIcon className="h-4 w-4 text-red-400" />{t('discounts.delete')}
          </button>
        </div>}
      </div>
    </div>
  );
}
