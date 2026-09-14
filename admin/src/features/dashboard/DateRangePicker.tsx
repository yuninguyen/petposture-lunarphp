import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { ArrowLeft, Calendar, ChevronDown, ChevronRight } from 'lucide-react';
import { DayPicker, type DateRange } from 'react-day-picker';
import 'react-day-picker/style.css';

export interface DateRangeValue {
  preset:
    | 'today'
    | 'yesterday'
    | 'last_7_days'
    | 'last_30_days'
    | 'last_90_days'
    | 'last_365_days'
    | 'last_week'
    | 'last_month'
    | 'last_quarter'
    | 'last_12_months'
    | 'last_year'
    | 'week_to_date'
    | 'month_to_date'
    | 'quarter_to_date'
    | 'year_to_date'
    | 'quarter'
    | 'custom';
  quarter?: string; // 'YYYY-Q[1-4]', only when preset === 'quarter'
  startDate?: string; // 'YYYY-MM-DD', only when preset === 'custom'
  endDate?: string; // 'YYYY-MM-DD', only when preset === 'custom'
}

export function getRecentQuarters(now: Date = new Date()): { label: string; value: string }[] {
  const currentMonth = now.getMonth(); // 0 to 11
  const currentQuarter = Math.floor(currentMonth / 3) + 1; // 1 to 4
  const currentYear = now.getFullYear();

  const quarters: { label: string; value: string }[] = [];

  for (let i = 0; i < 4; i++) {
    let q = currentQuarter - i;
    let y = currentYear;
    while (q <= 0) {
      q += 4;
      y -= 1;
    }
    quarters.push({
      label: `Q${q} ${y}`,
      value: `${y}-Q${q}`,
    });
  }

  return quarters;
}

import type { TFunction } from 'i18next';

export function formatPresetLabel(value: DateRangeValue, t: TFunction): string {
  if (value.preset === 'quarter') {
    if (value.quarter) {
      const match = value.quarter.match(/^(\d{4})-Q([1-4])$/);
      if (match) {
        return `Q${match[2]} ${match[1]}`;
      }
      return value.quarter;
    }
    return t('date_range_picker.quarters', 'Quarters');
  }

  if (value.preset === 'custom') {
    if (value.startDate && value.endDate) {
      return `${value.startDate} → ${value.endDate}`;
    }
    return t('date_range_picker.custom_range', 'Custom range');
  }

  const map: Record<string, string> = {
    today: t('date_range_picker.today', 'Today'),
    yesterday: t('date_range_picker.yesterday', 'Yesterday'),
    last_7_days: t('date_range_picker.last_7_days', 'Last 7 days'),
    last_30_days: t('date_range_picker.last_30_days', 'Last 30 days'),
    last_90_days: t('date_range_picker.last_90_days', 'Last 90 days'),
    last_365_days: t('date_range_picker.last_365_days', 'Last 365 days'),
    last_week: t('date_range_picker.last_week', 'Last week'),
    last_month: t('date_range_picker.last_month', 'Last month'),
    last_quarter: t('date_range_picker.last_quarter', 'Last quarter'),
    last_12_months: t('date_range_picker.last_12_months', 'Last 12 months'),
    last_year: t('date_range_picker.last_year', 'Last year'),
    week_to_date: t('date_range_picker.week_to_date', 'Week to date'),
    month_to_date: t('date_range_picker.month_to_date', 'Month to date'),
    quarter_to_date: t('date_range_picker.quarter_to_date', 'Quarter to date'),
    year_to_date: t('date_range_picker.year_to_date', 'Year to date'),
  };

  return map[value.preset] || value.preset;
}

function formatDateToYMD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseYMDToDate(s?: string): Date | undefined {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const [y, m, d] = s.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime())) return undefined;
  return date;
}

type ViewState = 'root' | 'last' | 'period_to_date' | 'quarters' | 'custom';

export function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [viewState, setViewState] = useState<ViewState>('root');

  const [customStart, setCustomStart] = useState<string>(
    value.preset === 'custom' && value.startDate ? value.startDate : ''
  );
  const [customEnd, setCustomEnd] = useState<string>(
    value.preset === 'custom' && value.endDate ? value.endDate : ''
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      setViewState('root');
      if (value.preset === 'custom') {
        setCustomStart(value.startDate || '');
        setCustomEnd(value.endDate || '');
      }
    }
  }, [open, value]);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
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

  const handleLeafSelect = (nextValue: DateRangeValue) => {
    onChange(nextValue);
    setOpen(false);
  };

  const isApplyDisabled = !customStart || !customEnd || customStart > customEnd;

  const handleApply = () => {
    if (isApplyDisabled) return;
    onChange({
      preset: 'custom',
      startDate: customStart,
      endDate: customEnd,
    });
    setOpen(false);
  };

  const handleCancel = () => {
    setOpen(false);
  };

  const itemClass = (active: boolean) =>
    clsx(
      'flex w-full items-center justify-between px-4 py-2 text-left text-sm transition-colors',
      active
        ? 'bg-secondary-light font-medium text-secondary-dark'
        : 'text-gray-700 hover:bg-gray-50'
    );

  const parentItemClass =
    'flex w-full items-center justify-between px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors';

  const lastItems: { key: DateRangeValue['preset']; label: string }[] = [
    { key: 'last_7_days', label: t('date_range_picker.last_7_days', 'Last 7 days') },
    { key: 'last_30_days', label: t('date_range_picker.last_30_days', 'Last 30 days') },
    { key: 'last_90_days', label: t('date_range_picker.last_90_days', 'Last 90 days') },
    { key: 'last_365_days', label: t('date_range_picker.last_365_days', 'Last 365 days') },
    { key: 'last_week', label: t('date_range_picker.last_week', 'Last week') },
    { key: 'last_month', label: t('date_range_picker.last_month', 'Last month') },
    { key: 'last_quarter', label: t('date_range_picker.last_quarter', 'Last quarter') },
    { key: 'last_12_months', label: t('date_range_picker.last_12_months', 'Last 12 months') },
    { key: 'last_year', label: t('date_range_picker.last_year', 'Last year') },
  ];

  const periodToDateItems: { key: DateRangeValue['preset']; label: string }[] = [
    { key: 'week_to_date', label: t('date_range_picker.week_to_date', 'Week to date') },
    { key: 'month_to_date', label: t('date_range_picker.month_to_date', 'Month to date') },
    { key: 'quarter_to_date', label: t('date_range_picker.quarter_to_date', 'Quarter to date') },
    { key: 'year_to_date', label: t('date_range_picker.year_to_date', 'Year to date') },
  ];

  const quarterItems = getRecentQuarters(new Date());

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-secondary"
      >
        <Calendar className="h-4 w-4 text-gray-500" />
        <span>{formatPresetLabel(value, t)}</span>
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </button>

      {open && (
        <div
          role="menu"
          className={clsx(
            'absolute z-50 mt-2 rounded-lg border border-gray-200 bg-white shadow-xl',
            viewState === 'custom' ? 'right-0 w-max min-w-[600px]' : 'left-0 min-w-[240px]'
          )}
        >
          {viewState === 'root' && (
            <div className="py-1">
              <button
                type="button"
                role="menuitem"
                onClick={() => handleLeafSelect({ preset: 'today' })}
                className={itemClass(value.preset === 'today')}
              >
                {t('date_range_picker.today', 'Today')}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => handleLeafSelect({ preset: 'yesterday' })}
                className={itemClass(value.preset === 'yesterday')}
              >
                {t('date_range_picker.yesterday', 'Yesterday')}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => setViewState('last')}
                className={parentItemClass}
              >
                <span>{t('date_range_picker.last', 'Last')}</span>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => setViewState('period_to_date')}
                className={parentItemClass}
              >
                <span>{t('date_range_picker.period_to_date', 'Period to date')}</span>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => setViewState('quarters')}
                className={parentItemClass}
              >
                <span>{t('date_range_picker.quarters', 'Quarters')}</span>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </button>
              <div className="my-1 border-t border-gray-100" />
              <button
                type="button"
                role="menuitem"
                onClick={() => setViewState('custom')}
                className={parentItemClass}
              >
                <span>{t('date_range_picker.custom_range', 'Custom range')}</span>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </button>
            </div>
          )}

          {viewState === 'last' && (
            <div className="py-1">
              <div className="flex items-center border-b border-gray-100 px-3 py-2">
                <button
                  type="button"
                  onClick={() => setViewState('root')}
                  className="flex items-center text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  <span>{t('date_range_picker.last', 'Last')}</span>
                </button>
              </div>
              <div className="py-1">
                {lastItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    role="menuitem"
                    onClick={() => handleLeafSelect({ preset: item.key })}
                    className={itemClass(value.preset === item.key)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {viewState === 'period_to_date' && (
            <div className="py-1">
              <div className="flex items-center border-b border-gray-100 px-3 py-2">
                <button
                  type="button"
                  onClick={() => setViewState('root')}
                  className="flex items-center text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  <span>{t('date_range_picker.period_to_date', 'Period to date')}</span>
                </button>
              </div>
              <div className="py-1">
                {periodToDateItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    role="menuitem"
                    onClick={() => handleLeafSelect({ preset: item.key })}
                    className={itemClass(value.preset === item.key)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {viewState === 'quarters' && (
            <div className="py-1">
              <div className="flex items-center border-b border-gray-100 px-3 py-2">
                <button
                  type="button"
                  onClick={() => setViewState('root')}
                  className="flex items-center text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  <span>{t('date_range_picker.quarters', 'Quarters')}</span>
                </button>
              </div>
              <div className="py-1">
                {quarterItems.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    role="menuitem"
                    onClick={() =>
                      handleLeafSelect({ preset: 'quarter', quarter: item.value })
                    }
                    className={itemClass(
                      value.preset === 'quarter' && value.quarter === item.value
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {viewState === 'custom' && (
            <div>
              <div className="flex items-center border-b border-gray-100 px-3 py-2">
                <button
                  type="button"
                  onClick={() => setViewState('root')}
                  className="flex items-center text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  <span>{t('date_range_picker.custom_range', 'Custom range')}</span>
                </button>
              </div>

              <div className="flex items-center gap-2 border-b border-gray-100 p-3">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    {t('date_range_picker.start_date', 'Start date')}
                  </label>
                  <input
                    type="text"
                    aria-label={t('date_range_picker.start_date', 'Start date')}
                    placeholder="YYYY-MM-DD"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:border-secondary focus:outline-none"
                  />
                </div>
                <span className="mt-4 text-gray-400">→</span>
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    {t('date_range_picker.end_date', 'End date')}
                  </label>
                  <input
                    type="text"
                    aria-label={t('date_range_picker.end_date', 'End date')}
                    placeholder="YYYY-MM-DD"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:border-secondary focus:outline-none"
                  />
                </div>
              </div>

              <div
                className="flex justify-center overflow-auto p-2 text-sm [&_.rdp-month_caption]:text-sm [&_.rdp-month_caption]:font-semibold [&_.rdp-selected]:!text-sm"
                data-testid="day-picker-container"
              >
                <DayPicker
                  mode="range"
                  numberOfMonths={2}
                  style={{
                    '--rdp-accent-color': '#df8448',
                    '--rdp-accent-background-color': '#fdf2ea',
                    '--rdp-day-width': '34px',
                    '--rdp-day-height': '34px',
                    '--rdp-day_button-width': '32px',
                    '--rdp-day_button-height': '32px',
                    '--rdp-week_number-width': '34px',
                    '--rdp-week_number-height': '34px',
                    '--rdp-nav-height': '2rem',
                    '--rdp-nav_button-width': '1.75rem',
                    '--rdp-nav_button-height': '1.75rem',
                    '--rdp-months-gap': '1.5rem',
                  } as React.CSSProperties}
                  defaultMonth={parseYMDToDate(customStart) || new Date()}
                  selected={{
                    from: parseYMDToDate(customStart),
                    to: parseYMDToDate(customEnd),
                  }}
                  onSelect={(range: DateRange | undefined) => {
                    setCustomStart(range?.from ? formatDateToYMD(range.from) : '');
                    setCustomEnd(range?.to ? formatDateToYMD(range.to) : '');
                  }}
                />
              </div>

              <div className="flex items-center justify-end gap-2 rounded-b-lg border-t border-gray-100 bg-gray-50 px-3 py-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  {t('date_range_picker.cancel', 'Cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={isApplyDisabled}
                  className={clsx(
                    'rounded px-3 py-1.5 text-xs font-medium text-white transition-colors',
                    isApplyDisabled
                      ? 'cursor-not-allowed bg-secondary/40'
                      : 'bg-secondary hover:bg-secondary-dark'
                  )}
                >
                  {t('date_range_picker.apply', 'Apply')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
