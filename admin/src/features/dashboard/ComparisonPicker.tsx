import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { ArrowLeft, ArrowLeftRight, ChevronDown, ChevronRight } from 'lucide-react';

export type ComparisonValue =
  | { comparison: 'none' }
  | { comparison: 'yesterday' }
  | { comparison: 'previous_year' }
  | { comparison: 'previous_year_match_day' }
  | { comparison: 'custom'; compareStartDate: string; compareEndDate: string };

import type { TFunction } from 'i18next';

export function formatComparisonLabel(value: ComparisonValue, t: TFunction): string {
  switch (value.comparison) {
    case 'none':
      return t('comparison_picker.no_comparison', 'No comparison');
    case 'yesterday':
      return t('comparison_picker.yesterday', 'Yesterday');
    case 'previous_year':
      return t('comparison_picker.previous_year', 'Previous year');
    case 'previous_year_match_day':
      return t(
        'comparison_picker.previous_year_match_day',
        'Previous year (match day of week)'
      );
    case 'custom':
      if (value.compareStartDate && value.compareEndDate) {
        return `Compare: ${value.compareStartDate} → ${value.compareEndDate}`;
      }
      return t('comparison_picker.custom', 'Custom');
    default:
      return t('comparison_picker.no_comparison', 'No comparison');
  }
}

export function ComparisonPicker({
  value,
  onChange,
  allowYesterday,
}: {
  value: ComparisonValue;
  onChange: (next: ComparisonValue) => void;
  allowYesterday: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);

  const [customStart, setCustomStart] = useState<string>(
    value.comparison === 'custom' && value.compareStartDate ? value.compareStartDate : ''
  );
  const [customEnd, setCustomEnd] = useState<string>(
    value.comparison === 'custom' && value.compareEndDate ? value.compareEndDate : ''
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      setShowCustom(false);
      if (value.comparison === 'custom') {
        setCustomStart(value.compareStartDate || '');
        setCustomEnd(value.compareEndDate || '');
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

  const handleLeafSelect = (nextValue: ComparisonValue) => {
    onChange(nextValue);
    setOpen(false);
  };

  const isApplyDisabled =
    !customStart ||
    !customEnd ||
    customStart > customEnd ||
    !/^\d{4}-\d{2}-\d{2}$/.test(customStart) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(customEnd);

  const handleApply = () => {
    if (isApplyDisabled) return;
    onChange({
      comparison: 'custom',
      compareStartDate: customStart,
      compareEndDate: customEnd,
    });
    setOpen(false);
    setShowCustom(false);
  };

  const handleCancel = () => {
    setOpen(false);
    setShowCustom(false);
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
        <ArrowLeftRight className="h-4 w-4 text-gray-500" />
        <span>{formatComparisonLabel(value, t)}</span>
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 z-50 mt-2 rounded-lg border border-gray-200 bg-white shadow-xl min-w-[240px]"
        >
          {!showCustom ? (
            <div className="py-1">
              <button
                type="button"
                role="menuitem"
                onClick={() => handleLeafSelect({ comparison: 'none' })}
                className={itemClass(value.comparison === 'none')}
              >
                {t('comparison_picker.no_comparison', 'No comparison')}
              </button>

              {allowYesterday && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleLeafSelect({ comparison: 'yesterday' })}
                  className={itemClass(value.comparison === 'yesterday')}
                >
                  {t('comparison_picker.yesterday', 'Yesterday')}
                </button>
              )}

              <button
                type="button"
                role="menuitem"
                onClick={() => handleLeafSelect({ comparison: 'previous_year' })}
                className={itemClass(value.comparison === 'previous_year')}
              >
                {t('comparison_picker.previous_year', 'Previous year')}
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => handleLeafSelect({ comparison: 'previous_year_match_day' })}
                className={itemClass(value.comparison === 'previous_year_match_day')}
              >
                {t(
                  'comparison_picker.previous_year_match_day',
                  'Previous year (match day of week)'
                )}
              </button>

              <div className="my-1 border-t border-gray-100" />

              <button
                type="button"
                role="menuitem"
                onClick={() => setShowCustom(true)}
                className={parentItemClass}
              >
                <span>{t('comparison_picker.custom', 'Custom')}</span>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-center border-b border-gray-100 px-3 py-2">
                <button
                  type="button"
                  onClick={() => setShowCustom(false)}
                  className="flex items-center text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  <span>{t('comparison_picker.custom', 'Custom')}</span>
                </button>
              </div>

              <div className="flex flex-col gap-2 border-b border-gray-100 p-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    {t('comparison_picker.compare_start_date', 'Compare start date')}
                  </label>
                  <input
                    type="text"
                    aria-label={t(
                      'comparison_picker.compare_start_date',
                      'Compare start date'
                    )}
                    placeholder="YYYY-MM-DD"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:border-secondary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    {t('comparison_picker.compare_end_date', 'Compare end date')}
                  </label>
                  <input
                    type="text"
                    aria-label={t('comparison_picker.compare_end_date', 'Compare end date')}
                    placeholder="YYYY-MM-DD"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:border-secondary focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 rounded-b-lg border-t border-gray-100 bg-gray-50 px-3 py-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  {t('comparison_picker.cancel', 'Cancel')}
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
                  {t('comparison_picker.apply', 'Apply')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
