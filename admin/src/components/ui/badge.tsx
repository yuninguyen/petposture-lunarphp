import { ReactNode } from 'react';

export const BADGE_COLORS = {
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  slate: 'bg-slate-50 text-slate-700 border-slate-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  red: 'bg-red-50 text-red-700 border-red-200',
};

export type BadgeColor = keyof typeof BADGE_COLORS;

export function Badge({ children, color = 'slate', className = '' }: { children: ReactNode; color?: BadgeColor; className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-md text-xs font-semibold border ${BADGE_COLORS[color]} ${className}`}>
      {children}
    </span>
  );
}
