import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  DateRangePicker,
  formatPresetLabel,
  getRecentQuarters,
  type DateRangeValue,
} from './DateRangePicker';

import type { TFunction } from 'i18next';

const mockT = ((key: string, fallback?: string) => fallback ?? key) as unknown as TFunction;

describe('formatPresetLabel', () => {
  it('formats named presets with static display strings', () => {
    expect(formatPresetLabel({ preset: 'today' }, mockT)).toBe('Today');
    expect(formatPresetLabel({ preset: 'yesterday' }, mockT)).toBe('Yesterday');
    expect(formatPresetLabel({ preset: 'last_7_days' }, mockT)).toBe('Last 7 days');
    expect(formatPresetLabel({ preset: 'last_30_days' }, mockT)).toBe('Last 30 days');
    expect(formatPresetLabel({ preset: 'last_90_days' }, mockT)).toBe('Last 90 days');
    expect(formatPresetLabel({ preset: 'last_365_days' }, mockT)).toBe('Last 365 days');
    expect(formatPresetLabel({ preset: 'last_week' }, mockT)).toBe('Last week');
    expect(formatPresetLabel({ preset: 'last_month' }, mockT)).toBe('Last month');
    expect(formatPresetLabel({ preset: 'last_quarter' }, mockT)).toBe('Last quarter');
    expect(formatPresetLabel({ preset: 'last_12_months' }, mockT)).toBe('Last 12 months');
    expect(formatPresetLabel({ preset: 'last_year' }, mockT)).toBe('Last year');
    expect(formatPresetLabel({ preset: 'week_to_date' }, mockT)).toBe('Week to date');
    expect(formatPresetLabel({ preset: 'month_to_date' }, mockT)).toBe('Month to date');
    expect(formatPresetLabel({ preset: 'quarter_to_date' }, mockT)).toBe('Quarter to date');
    expect(formatPresetLabel({ preset: 'year_to_date' }, mockT)).toBe('Year to date');
  });

  it('formats quarter preset to Q[1-4] YYYY', () => {
    expect(formatPresetLabel({ preset: 'quarter', quarter: '2026-Q3' }, mockT)).toBe('Q3 2026');
    expect(formatPresetLabel({ preset: 'quarter', quarter: '2025-Q4' }, mockT)).toBe('Q4 2025');
    expect(formatPresetLabel({ preset: 'quarter' }, mockT)).toBe('Quarters');
  });

  it('formats custom preset as startDate → endDate when both set, else Custom range', () => {
    expect(
      formatPresetLabel(
        {
          preset: 'custom',
          startDate: '2026-09-01',
          endDate: '2026-09-14',
        },
        mockT
      )
    ).toBe('2026-09-01 → 2026-09-14');
    expect(formatPresetLabel({ preset: 'custom' }, mockT)).toBe('Custom range');
    expect(
      formatPresetLabel({ preset: 'custom', startDate: '2026-09-01' }, mockT)
    ).toBe('Custom range');
  });
});

describe('getRecentQuarters', () => {
  it('returns current quarter and previous 3 quarters spanning a year boundary', () => {
    // Q3 2026: should be Q3 2026, Q2 2026, Q1 2026, Q4 2025
    const q3Results = getRecentQuarters(new Date('2026-09-14T12:00:00Z'));
    expect(q3Results).toEqual([
      { label: 'Q3 2026', value: '2026-Q3' },
      { label: 'Q2 2026', value: '2026-Q2' },
      { label: 'Q1 2026', value: '2026-Q1' },
      { label: 'Q4 2025', value: '2025-Q4' },
    ]);

    // Q1 2026: should be Q1 2026, Q4 2025, Q3 2025, Q2 2025
    const q1Results = getRecentQuarters(new Date('2026-02-10T12:00:00Z'));
    expect(q1Results).toEqual([
      { label: 'Q1 2026', value: '2026-Q1' },
      { label: 'Q4 2025', value: '2025-Q4' },
      { label: 'Q3 2025', value: '2025-Q3' },
      { label: 'Q2 2025', value: '2025-Q2' },
    ]);
  });
});

describe('DateRangePicker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-14T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders closed with the correct label for a given value prop', () => {
    const onChange = vi.fn();

    // 1. Last family
    const { rerender } = render(
      <DateRangePicker value={{ preset: 'last_30_days' }} onChange={onChange} />
    );
    expect(screen.getByRole('button', { name: /last 30 days/i })).toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    // 2. Period to date family
    rerender(<DateRangePicker value={{ preset: 'week_to_date' }} onChange={onChange} />);
    expect(screen.getByRole('button', { name: /week to date/i })).toBeInTheDocument();

    // 3. Quarter family
    rerender(
      <DateRangePicker value={{ preset: 'quarter', quarter: '2026-Q3' }} onChange={onChange} />
    );
    expect(screen.getByRole('button', { name: /q3 2026/i })).toBeInTheDocument();

    // 4. Custom range family
    rerender(
      <DateRangePicker
        value={{ preset: 'custom', startDate: '2026-09-01', endDate: '2026-09-14' }}
        onChange={onChange}
      />
    );
    expect(
      screen.getByRole('button', { name: /2026-09-01 → 2026-09-14/i })
    ).toBeInTheDocument();
  });

  it('clicking the trigger opens the dropdown showing the root list', () => {
    const onChange = vi.fn();
    render(<DateRangePicker value={{ preset: 'today' }} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /today/i }));

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Yesterday' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Last' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Period to date' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Quarters' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Custom range' })).toBeInTheDocument();
  });

  it('clicking "Last" shows the "Last" submenu with all 9 items, not the root list', () => {
    const onChange = vi.fn();
    render(<DateRangePicker value={{ preset: 'today' }} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /today/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Last' }));

    // Root list is gone
    expect(screen.queryByRole('menuitem', { name: 'Today' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Yesterday' })).not.toBeInTheDocument();

    // Submenu header
    expect(screen.getByText('Last')).toBeInTheDocument();

    // All 9 items
    const expected = [
      'Last 7 days',
      'Last 30 days',
      'Last 90 days',
      'Last 365 days',
      'Last week',
      'Last month',
      'Last quarter',
      'Last 12 months',
      'Last year',
    ];
    for (const name of expected) {
      expect(screen.getByRole('menuitem', { name })).toBeInTheDocument();
    }
  });

  it('clicking a leaf (e.g. "Last 90 days") calls onChange({ preset: "last_90_days" }) exactly once and the dropdown closes', () => {
    const onChange = vi.fn();
    render(<DateRangePicker value={{ preset: 'today' }} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /today/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Last' }));

    fireEvent.click(screen.getByRole('menuitem', { name: 'Last 90 days' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ preset: 'last_90_days' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('clicking "Quarters" shows exactly 4 dynamically-generated quarter items', () => {
    const onChange = vi.fn();
    render(<DateRangePicker value={{ preset: 'today' }} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /today/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Quarters' }));

    // For 2026-09-14 (Q3 2026): Q3 2026, Q2 2026, Q1 2026, Q4 2025
    expect(screen.getByRole('menuitem', { name: 'Q3 2026' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Q2 2026' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Q1 2026' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Q4 2025' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Q2 2026' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ preset: 'quarter', quarter: '2026-Q2' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('clicking "Custom range" keeps the dropdown open, shows calendar and Apply/Cancel', () => {
    const onChange = vi.fn();
    render(<DateRangePicker value={{ preset: 'today' }} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /today/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Custom range' }));

    // Does not call onChange yet
    expect(onChange).not.toHaveBeenCalled();

    // Shows calendar container and text inputs
    expect(screen.getByTestId('day-picker-container')).toBeInTheDocument();
    expect(screen.getByLabelText('Start date')).toBeInTheDocument();
    expect(screen.getByLabelText('End date')).toBeInTheDocument();

    // Shows Cancel and Apply buttons
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
  });

  it('picking a range then clicking "Apply" calls onChange({ preset: "custom", startDate, endDate }) exactly once', () => {
    const onChange = vi.fn();
    render(<DateRangePicker value={{ preset: 'today' }} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /today/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Custom range' }));

    // Apply is initially disabled since startDate/endDate are unset
    const applyButton = screen.getByRole('button', { name: 'Apply' });
    expect(applyButton).toBeDisabled();

    // Set valid start and end dates
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-09-14' } });

    expect(applyButton).toBeEnabled();

    fireEvent.click(applyButton);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      preset: 'custom',
      startDate: '2026-09-01',
      endDate: '2026-09-14',
    });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('disables Apply when startDate > endDate', () => {
    const onChange = vi.fn();
    render(<DateRangePicker value={{ preset: 'today' }} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /today/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Custom range' }));

    const applyButton = screen.getByRole('button', { name: 'Apply' });

    // Invalid range: start > end
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-09-20' } });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-09-10' } });

    expect(applyButton).toBeDisabled();
    fireEvent.click(applyButton);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('clicking "Cancel" in the custom-range panel closes the dropdown without calling onChange', () => {
    const onChange = vi.fn();
    render(<DateRangePicker value={{ preset: 'today' }} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /today/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Custom range' }));

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('escape key and outside-click both close the dropdown without calling onChange', () => {
    const onChange = vi.fn();
    render(<DateRangePicker value={{ preset: 'today' }} onChange={onChange} />);

    // 1. Escape key
    fireEvent.click(screen.getByRole('button', { name: /today/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();

    // 2. Outside click
    fireEvent.click(screen.getByRole('button', { name: /today/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
