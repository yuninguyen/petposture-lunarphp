import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoalsPage } from './GoalsPage';
import type { GoalsData } from './goalsApi';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, fetchJson: vi.fn() };
});

import { fetchJson } from '@/lib/api';

const mockGoalsData: GoalsData = {
  goals: [
    {
      key: 'monthly_revenue_target',
      label: 'Monthly Revenue Target',
      actual: 15400.5,
      target: 25000,
      unit: 'currency',
      uncapped_percent: 61.6,
      percent: 62,
    },
    {
      key: 'monthly_orders_target',
      label: 'Monthly Orders Target',
      actual: 120,
      target: 200,
      unit: 'number',
      uncapped_percent: 60.0,
      percent: 60,
    },
    {
      key: 'monthly_new_customers_target',
      label: 'Monthly New Customers Target',
      actual: 45,
      target: null,
      unit: 'number',
      uncapped_percent: null,
      percent: null,
    },
  ],
};

function mockGetGoals(data: GoalsData = mockGoalsData) {
  vi.mocked(fetchJson).mockImplementation(async (_endpoint, options) => {
    if (!options || (options.method ?? 'GET') === 'GET') {
      return { data } as never;
    }
    return { data } as never;
  });
}

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <GoalsPage />
    </QueryClientProvider>
  );
}

describe('GoalsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders existing goal values, actuals, and progress bars', async () => {
    mockGetGoals();

    renderWithProviders();

    expect(screen.getByRole('status')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('Monthly Goals')).toBeDefined();
    });

    const revenueInput = screen.getByLabelText(/Monthly Revenue Target/i) as HTMLInputElement;
    const ordersInput = screen.getByLabelText(/Monthly Orders Target/i) as HTMLInputElement;
    const customersInput = screen.getByLabelText(/Monthly New Customers Target/i) as HTMLInputElement;

    expect(revenueInput.value).toBe('25000');
    expect(ordersInput.value).toBe('200');
    expect(customersInput.value).toBe('');

    // Check progress and actuals
    expect(screen.getAllByText(/61.6%/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/No target set/i)).toBeDefined();
  });

  it('submits updated numeric targets', async () => {
    vi.mocked(fetchJson).mockImplementation(async (_endpoint, options) => {
      if (options && (options.method ?? 'GET') === 'PUT') {
        return {
          data: {
            goals: [
              {
                key: 'monthly_revenue_target',
                label: 'Monthly Revenue Target',
                actual: 15400.5,
                target: 30000,
                unit: 'currency',
                uncapped_percent: 51.3,
                percent: 51,
              },
              {
                key: 'monthly_orders_target',
                label: 'Monthly Orders Target',
                actual: 120,
                target: 250,
                unit: 'number',
                uncapped_percent: 48.0,
                percent: 48,
              },
              {
                key: 'monthly_new_customers_target',
                label: 'Monthly New Customers Target',
                actual: 45,
                target: 60,
                unit: 'number',
                uncapped_percent: 75.0,
                percent: 75,
              },
            ],
          },
        } as never;
      }
      return { data: mockGoalsData } as never;
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByLabelText(/Monthly Revenue Target/i)).toBeDefined();
    });

    const revenueInput = screen.getByLabelText(/Monthly Revenue Target/i);
    const ordersInput = screen.getByLabelText(/Monthly Orders Target/i);
    const customersInput = screen.getByLabelText(/Monthly New Customers Target/i);

    fireEvent.change(revenueInput, { target: { value: '30000' } });
    fireEvent.change(ordersInput, { target: { value: '250' } });
    fireEvent.change(customersInput, { target: { value: '60' } });

    const saveButton = screen.getByRole('button', { name: /Save Goals/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(fetchJson).toHaveBeenCalledWith(
        '/admin/goals',
        expect.objectContaining({
          method: 'PUT',
          body: {
            monthly_revenue_target: 30000,
            monthly_orders_target: 250,
            monthly_new_customers_target: 60,
          },
        })
      );
    });
  });

  it('submits null to clear targets to unconfigured when inputs are emptied', async () => {
    vi.mocked(fetchJson).mockImplementation(async (_endpoint, options) => {
      if (options && (options.method ?? 'GET') === 'PUT') {
        return {
          data: {
            goals: mockGoalsData.goals.map((g) => ({ ...g, target: null, percent: null, uncapped_percent: null })),
          },
        } as never;
      }
      return { data: mockGoalsData } as never;
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByLabelText(/Monthly Revenue Target/i)).toBeDefined();
    });

    const revenueInput = screen.getByLabelText(/Monthly Revenue Target/i);
    fireEvent.change(revenueInput, { target: { value: '' } });

    const saveButton = screen.getByRole('button', { name: /Save Goals/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(fetchJson).toHaveBeenCalledWith(
        '/admin/goals',
        expect.objectContaining({
          method: 'PUT',
          body: expect.objectContaining({ monthly_revenue_target: null }),
        })
      );
    });
  });

  it('surfaces per-field validation errors visibly without failing silently', async () => {
    const error = Object.assign(new Error('Validation failed'), {
      status: 422,
      data: {
        message: 'The given data was invalid.',
        errors: {
          monthly_revenue_target: ['The monthly revenue target field must be at least 0.'],
          monthly_orders_target: ['The monthly orders target must be an integer.'],
        },
      },
    });

    vi.mocked(fetchJson).mockImplementation(async (_endpoint, options) => {
      if (options && (options.method ?? 'GET') === 'PUT') {
        throw error;
      }
      return { data: mockGoalsData } as never;
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByLabelText(/Monthly Revenue Target/i)).toBeDefined();
    });

    const saveButton = screen.getByRole('button', { name: /Save Goals/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('The monthly revenue target field must be at least 0.')).toBeDefined();
      expect(screen.getByText('The monthly orders target must be an integer.')).toBeDefined();
    });
  });
});
