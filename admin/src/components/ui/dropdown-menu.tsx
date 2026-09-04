import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

interface DropdownMenuItem {
  key: string;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}

export function DropdownMenu({ items, label = 'More actions' }: { items: DropdownMenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (open) itemRefs.current[0]?.focus();

    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (open && event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (items.length === 0) return null;

  function handleItemKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | undefined;
    if (event.key === 'ArrowDown') nextIndex = (index + 1) % items.length;
    if (event.key === 'ArrowUp') nextIndex = (index - 1 + items.length) % items.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = items.length - 1;
    if (nextIndex === undefined) return;
    event.preventDefault();
    itemRefs.current[nextIndex]?.focus();
  }

  return <div className="relative" ref={ref}>
    <button ref={triggerRef} type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((current) => !current)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-primary hover:bg-gray-50">•••</button>
    {open && <div role="menu" className="absolute right-0 z-10 mt-2 w-48 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
      {items.map((item, index) => <button key={item.key} ref={(element) => { itemRefs.current[index] = element; }} role="menuitem" type="button" onKeyDown={(event) => handleItemKeyDown(event, index)} onClick={() => { setOpen(false); triggerRef.current?.focus(); item.onClick(); }} className={clsx('block w-full px-4 py-2 text-left text-sm hover:bg-gray-50', item.destructive ? 'text-red-600' : 'text-primary')}>{item.label}</button>)}
    </div>}
  </div>;
}
