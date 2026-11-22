import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import type { ChecklistItem, ChecklistStatus } from '@/lib/checklist';
import { Card } from './card';

const MARK: Record<ChecklistStatus, { symbol: string; tone: string }> = {
  ok: { symbol: '✓', tone: 'bg-green-100 text-green-700' },
  warn: { symbol: '!', tone: 'bg-amber-100 text-amber-700' },
  missing: { symbol: '✕', tone: 'bg-red-100 text-red-700' },
  note: { symbol: 'i', tone: 'bg-slate-100 text-slate-600' },
};

/** One line per thing to check, coloured by status. There is no total on purpose: it shows what is missing, not a grade. */
export function ChecklistCard({ title, hint, labelPrefix, items, testId }: { title: string; hint?: string; labelPrefix: string; items: ChecklistItem[]; testId?: string }) {
  const { t } = useTranslation();

  return (
    <Card className="p-5" data-testid={testId}>
      <h2 className="font-semibold">{title}</h2>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      <ul className="mt-3 space-y-3">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-3" data-status={item.status} data-item={item.id}>
            <span aria-hidden="true" className={clsx('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold', MARK[item.status].tone)}>
              {MARK[item.status].symbol}
            </span>
            <div className="min-w-0 text-sm">
              <p className="font-medium text-slate-800">
                <span className="sr-only">{t(`checklist.status.${item.status}`)}: </span>
                {t(`${labelPrefix}.${item.id}`)}
              </p>
              <p className="text-xs text-slate-500">{t(item.detail, item.params)}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
