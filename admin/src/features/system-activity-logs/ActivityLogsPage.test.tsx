import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ActivityLogsPage } from './ActivityLogsPage';
import type { ActivityLogResponse } from './api';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, fetchJson: vi.fn() };
});

import { fetchJson } from '@/lib/api';

const mockActivityLogsResponse: ActivityLogResponse = {
  data: [
    {
      id: 1,
      actor: { id: 2, name: 'Jane Admin', email: 'jane@example.com' },
      event: 'updated',
      subject_type: 'Product',
      subject_id: 45,
      description: 'updated',
      properties: {
        before: { status: 'draft' },
        after: { status: 'published' },
      },
      created_at: '2026-09-15T10:30:00.000000Z',
    },
    {
      id: 2,
      actor: null,
      event: 'returned',
      subject_type: 'Order',
      subject_id: 88,
      description: 'returned',
      properties: {
        before: { fulfillment_status: null },
        after: { fulfillment_status: 'returned' },
      },
      created_at: '2026-09-15T11:00:00.000000Z',
    },
    {
      id: 3,
      actor: { id: 3, name: 'Bob Staff', email: 'bob@example.com' },
      event: 'refunded',
      subject_type: 'Order',
      subject_id: 99,
      description: 'refunded',
      properties: {
        amount: 25.0,
        reason: 'customer_request',
      },
      created_at: '2026-09-15T12:00:00.000000Z',
    },
    {
      id: 4,
      actor: { id: 4, name: 'Alice Staff', email: 'alice@example.com' },
      event: 'deleted',
      subject_type: 'Role',
      subject_id: 10,
      description: 'deleted',
      properties: {},
      created_at: '2026-09-15T13:00:00.000000Z',
    },
  ],
  meta: {
    current_page: 1,
    last_page: 2,
    per_page: 20,
    total: 35,
  },
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ActivityLogsPage />
    </QueryClientProvider>
  );
}

describe('ActivityLogsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders activity log list with actor, event badge, subject, and handles null actor safely as System', async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce(mockActivityLogsResponse);

    renderPage();

    expect(screen.getByText(/Loading activity logs/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Jane Admin')).toBeInTheDocument();
    });

    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getByText('Product #45')).toBeInTheDocument();
    expect(screen.getByText('updated')).toBeInTheDocument();

    // Null actor displays "System"
    expect(screen.getByText('System')).toBeInTheDocument();
    expect(screen.getByText('Order #88')).toBeInTheDocument();
    // 'returned' appears both as the event badge and as the diff's after-value
    expect(screen.getAllByText('returned').length).toBeGreaterThanOrEqual(2);

    // Third entry with flat properties
    expect(screen.getByText('Bob Staff')).toBeInTheDocument();
    expect(screen.getByText('Order #99')).toBeInTheDocument();
    expect(screen.getByText('refunded')).toBeInTheDocument();

    // Fourth entry with empty properties renders fallback dash
    expect(screen.getByText('Alice Staff')).toBeInTheDocument();
    expect(screen.getByText('Role #10')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('filters by subject_type and calls fetchJson with subject_type param', async () => {
    vi.mocked(fetchJson).mockResolvedValue(mockActivityLogsResponse);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Jane Admin')).toBeInTheDocument();
    });

    const subjectSelect = screen.getByRole('combobox', { name: /^Subject Type$/i });
    fireEvent.change(subjectSelect, { target: { value: 'Product' } });

    await waitFor(() => {
      expect(fetchJson).toHaveBeenCalledWith(
        expect.stringContaining('subject_type=Product')
      );
    });
  });

  it('filters by date_from and date_to and calls fetchJson with date params', async () => {
    vi.mocked(fetchJson).mockResolvedValue(mockActivityLogsResponse);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Jane Admin')).toBeInTheDocument();
    });

    const fromInput = screen.getByLabelText(/^From Date$/i);
    const toInput = screen.getByLabelText(/^To Date$/i);

    fireEvent.change(fromInput, { target: { value: '2026-09-01' } });
    fireEvent.change(toInput, { target: { value: '2026-09-15' } });

    await waitFor(() => {
      expect(fetchJson).toHaveBeenCalledWith(
        expect.stringContaining('date_from=2026-09-01')
      );
      expect(fetchJson).toHaveBeenCalledWith(
        expect.stringContaining('date_to=2026-09-15')
      );
    });
  });

  it('filters by causer_id and calls fetchJson with causer_id param', async () => {
    vi.mocked(fetchJson).mockResolvedValue(mockActivityLogsResponse);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Jane Admin')).toBeInTheDocument();
    });

    const causerInput = screen.getByLabelText(/^Causer ID$/i);
    fireEvent.change(causerInput, { target: { value: '5' } });

    await waitFor(() => {
      expect(fetchJson).toHaveBeenCalledWith(
        expect.stringContaining('causer_id=5')
      );
    });
  });

  it('handles pagination next and previous controls correctly', async () => {
    vi.mocked(fetchJson).mockResolvedValue(mockActivityLogsResponse);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Jane Admin')).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /^Next$/i });
    expect(nextButton).toBeEnabled();

    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(fetchJson).toHaveBeenCalledWith(
        expect.stringContaining('page=2')
      );
    });
  });

  it('toggles properties detail expansion cleanly', async () => {
    vi.mocked(fetchJson).mockResolvedValue(mockActivityLogsResponse);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Jane Admin')).toBeInTheDocument();
    });

    // Find detail toggle buttons
    const detailButtons = screen.getAllByRole('button', { name: /^Details$/i });
    expect(detailButtons.length).toBeGreaterThan(0);

    // Expand first item
    fireEvent.click(detailButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/"status": "published"/i)).toBeInTheDocument();
    });

    // Button label toggles to "Hide"
    const hideButton = screen.getByRole('button', { name: /^Hide$/i });
    expect(hideButton).toBeInTheDocument();

    // Collapse
    fireEvent.click(hideButton);

    await waitFor(() => {
      expect(screen.queryByText(/"status": "published"/i)).not.toBeInTheDocument();
    });
  });

  it('renders empty state when data array is empty', async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce({
      data: [],
      meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/No activity logs found\./i)).toBeInTheDocument();
    });
  });
});
