import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  ComparisonPicker,
  formatComparisonLabel,
  type ComparisonValue,
} from './ComparisonPicker';

import type { TFunction } from 'i18next';

const mockT = ((key: string, fallback?: string) => fallback ?? key) as unknown as TFunction;

describe('formatComparisonLabel', () => {
  it('formats named comparison values', () => {
    expect(formatComparisonLabel({ comparison: 'none' }, mockT)).toBe('No comparison');
    expect(formatComparisonLabel({ comparison: 'yesterday' }, mockT)).toBe('Yesterday');
    expect(formatComparisonLabel({ comparison: 'previous_year' }, mockT)).toBe('Previous year');
    expect(formatComparisonLabel({ comparison: 'previous_year_match_day' }, mockT)).toBe(
      'Previous year (match day of week)'
    );
  });

  it('formats custom comparison when both dates set', () => {
    expect(
      formatComparisonLabel(
        {
          comparison: 'custom',
          compareStartDate: '2025-09-01',
          compareEndDate: '2025-09-14',
        },
        mockT
      )
    ).toBe('Compare: 2025-09-01 → 2025-09-14');
  });

  it('formats custom comparison with fallback to "Custom" when either date is unset', () => {
    expect(
      formatComparisonLabel(
        {
          comparison: 'custom',
          compareStartDate: '',
          compareEndDate: '',
        },
        mockT
      )
    ).toBe('Custom');

    expect(
      formatComparisonLabel(
        {
          comparison: 'custom',
          compareStartDate: '2025-09-01',
          compareEndDate: '',
        },
        mockT
      )
    ).toBe('Custom');
  });
});

describe('ComparisonPicker', () => {
  it('renders closed with the correct label for each comparison value', () => {
    const onChange = vi.fn();

    const { rerender } = render(
      <ComparisonPicker
        value={{ comparison: 'none' }}
        onChange={onChange}
        allowYesterday={false}
      />
    );
    expect(screen.getByRole('button', { name: /no comparison/i })).toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    rerender(
      <ComparisonPicker
        value={{ comparison: 'yesterday' }}
        onChange={onChange}
        allowYesterday={true}
      />
    );
    expect(screen.getByRole('button', { name: /^yesterday$/i })).toBeInTheDocument();

    rerender(
      <ComparisonPicker
        value={{ comparison: 'previous_year' }}
        onChange={onChange}
        allowYesterday={false}
      />
    );
    expect(screen.getByRole('button', { name: /previous year$/i })).toBeInTheDocument();

    rerender(
      <ComparisonPicker
        value={{ comparison: 'previous_year_match_day' }}
        onChange={onChange}
        allowYesterday={false}
      />
    );
    expect(
      screen.getByRole('button', { name: /previous year \(match day of week\)/i })
    ).toBeInTheDocument();

    rerender(
      <ComparisonPicker
        value={{
          comparison: 'custom',
          compareStartDate: '2025-09-01',
          compareEndDate: '2025-09-14',
        }}
        onChange={onChange}
        allowYesterday={false}
      />
    );
    expect(
      screen.getByRole('button', { name: /compare: 2025-09-01 → 2025-09-14/i })
    ).toBeInTheDocument();

    rerender(
      <ComparisonPicker
        value={{ comparison: 'custom', compareStartDate: '', compareEndDate: '' }}
        onChange={onChange}
        allowYesterday={false}
      />
    );
    expect(screen.getByRole('button', { name: /^custom$/i })).toBeInTheDocument();
  });

  it('with allowYesterday={true}, opening the dropdown shows all 5 items including "Yesterday"', () => {
    const onChange = vi.fn();
    render(
      <ComparisonPicker
        value={{ comparison: 'none' }}
        onChange={onChange}
        allowYesterday={true}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /no comparison/i }));

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'No comparison' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Yesterday' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Previous year' })).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: 'Previous year (match day of week)' })
    ).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Custom' })).toBeInTheDocument();

    expect(screen.getAllByRole('menuitem')).toHaveLength(5);
  });

  it('with allowYesterday={false}, opening the dropdown shows only 4 items — "Yesterday" is absent entirely', () => {
    const onChange = vi.fn();
    render(
      <ComparisonPicker
        value={{ comparison: 'none' }}
        onChange={onChange}
        allowYesterday={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /no comparison/i }));

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'No comparison' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Previous year' })).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: 'Previous year (match day of week)' })
    ).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Custom' })).toBeInTheDocument();

    // Absent from DOM
    expect(screen.queryByRole('menuitem', { name: 'Yesterday' })).toBeNull();
    expect(screen.getAllByRole('menuitem')).toHaveLength(4);
  });

  it('clicking "Previous year (match day of week)" calls onChange({ comparison: "previous_year_match_day" }) exactly once and closes', () => {
    const onChange = vi.fn();
    render(
      <ComparisonPicker
        value={{ comparison: 'none' }}
        onChange={onChange}
        allowYesterday={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /no comparison/i }));
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'Previous year (match day of week)' })
    );

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ comparison: 'previous_year_match_day' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('clicking "Custom" keeps dropdown open, shows two date inputs + Apply/Cancel, no calendar widget present', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ComparisonPicker
        value={{ comparison: 'none' }}
        onChange={onChange}
        allowYesterday={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /no comparison/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Custom' }));

    // Does not fire onChange yet
    expect(onChange).not.toHaveBeenCalled();

    // Two text inputs
    expect(screen.getByLabelText('Compare start date')).toBeInTheDocument();
    expect(screen.getByLabelText('Compare end date')).toBeInTheDocument();

    // Action buttons
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();

    // No calendar widget
    expect(container.querySelector('.rdp')).toBeNull();
    expect(container.querySelector('[data-testid="day-picker-container"]')).toBeNull();
  });

  it('apply is disabled when dates unset or start > end; enabled and calls onChange when valid', () => {
    const onChange = vi.fn();
    render(
      <ComparisonPicker
        value={{ comparison: 'none' }}
        onChange={onChange}
        allowYesterday={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /no comparison/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Custom' }));

    const applyButton = screen.getByRole('button', { name: 'Apply' });

    // Initially disabled (empty dates)
    expect(applyButton).toBeDisabled();

    // Invalid range: start > end
    fireEvent.change(screen.getByLabelText('Compare start date'), {
      target: { value: '2025-09-20' },
    });
    fireEvent.change(screen.getByLabelText('Compare end date'), {
      target: { value: '2025-09-10' },
    });
    expect(applyButton).toBeDisabled();

    // Valid range: start <= end
    fireEvent.change(screen.getByLabelText('Compare start date'), {
      target: { value: '2025-09-01' },
    });
    fireEvent.change(screen.getByLabelText('Compare end date'), {
      target: { value: '2025-09-14' },
    });
    expect(applyButton).toBeEnabled();

    fireEvent.click(applyButton);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      comparison: 'custom',
      compareStartDate: '2025-09-01',
      compareEndDate: '2025-09-14',
    });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('cancel closes without calling onChange', () => {
    const onChange = vi.fn();
    render(
      <ComparisonPicker
        value={{ comparison: 'none' }}
        onChange={onChange}
        allowYesterday={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /no comparison/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Custom' }));

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('escape and outside-click close without calling onChange', () => {
    const onChange = vi.fn();
    render(
      <ComparisonPicker
        value={{ comparison: 'none' }}
        onChange={onChange}
        allowYesterday={false}
      />
    );

    // 1. Escape key
    fireEvent.click(screen.getByRole('button', { name: /no comparison/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();

    // 2. Outside click
    fireEvent.click(screen.getByRole('button', { name: /no comparison/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('regression: asserts no element has a blue Tailwind class and uses brand secondary tokens', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ComparisonPicker
        value={{ comparison: 'none' }}
        onChange={onChange}
        allowYesterday={true}
      />
    );

    // Open dropdown
    fireEvent.click(screen.getByRole('button', { name: /no comparison/i }));

    // Active item (No comparison) should use secondary tokens
    const activeItem = screen.getByRole('menuitem', { name: 'No comparison' });
    expect(activeItem.className).toContain('bg-secondary-light');
    expect(activeItem.className).toContain('text-secondary-dark');

    // Switch to Custom to check Apply button
    fireEvent.click(screen.getByRole('menuitem', { name: 'Custom' }));
    const applyButton = screen.getByRole('button', { name: 'Apply' });
    expect(applyButton.className).toContain('secondary');

    // Assert that nowhere in the rendered DOM is there a blue-* Tailwind class
    const allElements = container.querySelectorAll('*');
    for (const el of allElements) {
      const classAttr = el.getAttribute('class') || '';
      expect(classAttr).not.toMatch(/\b(bg|text|border|ring)-blue\b/);
      expect(classAttr).not.toContain('blue');
    }
  });
});
