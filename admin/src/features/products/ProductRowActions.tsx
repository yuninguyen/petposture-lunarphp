import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DotsVerticalIcon, PencilIcon, TrashIcon } from '@/components/ui/icons';
import type { ProductSummary } from './api';

export function ProductRowActions({ product, onDelete }: { product: ProductSummary; onDelete: (product: ProductSummary) => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  function toggleMenu(event: React.MouseEvent<HTMLButtonElement>) {
    if (!open) {
      const rect = event.currentTarget.getBoundingClientRect();
      setPosition({ top: rect.bottom, left: rect.right });
    }
    setOpen((current) => !current);
  }

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    }

    function handleScroll(event: Event) {
      if (menuRef.current && menuRef.current.contains(event.target as Node)) return;
      setOpen(false);
    }

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [open]);

  return <div className="flex items-center justify-end" ref={menuRef}>
    <button type="button" title={t('products.action_more')} aria-label={t('products.action_more')} aria-expanded={open} onClick={toggleMenu} className="inline-flex items-center justify-center rounded p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700">
      <DotsVerticalIcon />
    </button>
    {open && <div className="fixed z-50 mt-1 min-w-[160px] -translate-x-full rounded-lg border border-slate-200 bg-white py-1 shadow-lg" style={{ top: position.top, left: position.left }}>
      <button type="button" onClick={() => { setOpen(false); navigate(`/products/${product.id}`); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50">
        <PencilIcon className="h-4 w-4 text-slate-400" />
        {t('common.edit')}
      </button>
      <button type="button" onClick={() => { setOpen(false); onDelete(product); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50">
        <TrashIcon className="h-4 w-4 text-red-400" />
        {t('common.delete')}
      </button>
    </div>}
  </div>;
}
