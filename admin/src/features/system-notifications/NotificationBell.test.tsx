import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NotificationBell, formatRelativeTime } from './NotificationBell';
import type { NotificationResponse } from './api';
import '@/i18n';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, fetchJson: vi.fn() };
});

import { fetchJson } from '@/lib/api';

const mockNotificationsResponse: NotificationResponse = {
  data: [
    {
      id: 'notif-1',
      type: 'new_customer',
      icon: 'heroicon-o-user-plus',
      color: 'info',
      title: 'New Customer Registered',
      body: 'John Doe created a new account.',
      url: 'http://localhost:8000/admin/users/1/edit',
      read_at: null,
      created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 mins ago
    },
    {
      id: 'notif-2',
      type: 'order_placed',
      icon: 'heroicon-o-shopping-bag',
      color: 'success',
      title: 'New Order Placed',
      body: 'Order #1042 was placed by Jane Smith.',
      url: 'http://localhost:8000/admin/orders/1042',
      read_at: null,
      created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(), // 2 hours ago
    },
    {
      id: 'notif-3',
      type: 'new_review',
      icon: 'heroicon-o-star',
      color: 'warning',
      title: 'New Review Submitted',
      body: 'A customer left a 5-star review.',
      url: 'http://localhost:8000/admin/reviews/42/edit',
      read_at: '2026-09-15T12:00:00.000000Z', // already read
      created_at: new Date(Date.now() - 2 * 86400 * 1000).toISOString(), // 2 days ago
    },
  ],
  meta: {
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 3,
    unread_count: 2,
  },
};

function renderBell() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <NotificationBell />
    </QueryClientProvider>
  );
}

describe('formatRelativeTime helper', () => {
  const t = (key: string, options?: Record<string, unknown>) => {
    if (key === 'system_notifications.just_now') return 'Just now';
    if (key === 'system_notifications.minutes_ago') return `${options?.count}m ago`;
    if (key === 'system_notifications.hours_ago') return `${options?.count}h ago`;
    if (key === 'system_notifications.days_ago') return `${options?.count}d ago`;
    return key;
  };

  it('formats dates within 1 minute as Just now', () => {
    const nowIso = new Date(Date.now() - 30 * 1000).toISOString();
    expect(formatRelativeTime(nowIso, t)).toBe('Just now');
  });

  it('formats dates within 1 hour as minutes ago', () => {
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    expect(formatRelativeTime(tenMinsAgo, t)).toBe('10m ago');
  });

  it('formats dates within 24 hours as hours ago', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    expect(formatRelativeTime(threeHoursAgo, t)).toBe('3h ago');
  });

  it('formats older dates as days ago', () => {
    const fourDaysAgo = new Date(Date.now() - 4 * 86400 * 1000).toISOString();
    expect(formatRelativeTime(fourDaysAgo, t)).toBe('4d ago');
  });
});

describe('NotificationBell Component', () => {
  beforeEach(() => {
    // clearAllMocks alone leaves queued mockResolvedValueOnce values from a
    // prior test in the queue (it clears call history, not implementations),
    // so a later test can consume a leftover response meant for an earlier
    // one. resetAllMocks clears queued implementations too.
    vi.resetAllMocks();
  });

  it('renders bell icon without badge when unread_count is 0', async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce({
      data: [],
      meta: { current_page: 1, last_page: 1, per_page: 20, total: 0, unread_count: 0 },
    });

    renderBell();

    const bellBtn = screen.getByRole('button', { name: /notification/i });
    expect(bellBtn).toBeInTheDocument();

    // No badge element
    await waitFor(() => {
      expect(screen.queryByText(/^[0-9]+$/)).not.toBeInTheDocument();
    });
  });

  it('renders badge with unread count when unread_count > 0', async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce(mockNotificationsResponse);

    renderBell();

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('renders 99+ when unread count exceeds 99', async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce({
      data: [],
      meta: { current_page: 1, last_page: 1, per_page: 20, total: 150, unread_count: 120 },
    });

    renderBell();

    await waitFor(() => {
      expect(screen.getByText('99+')).toBeInTheDocument();
    });
  });

  it('toggles dropdown and displays notification list with native <a href> links', async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce(mockNotificationsResponse);

    renderBell();

    const bellBtn = screen.getByRole('button', { name: /notification/i });
    fireEvent.click(bellBtn);

    await waitFor(() => {
      expect(screen.getByText('New Customer Registered')).toBeInTheDocument();
    });

    expect(screen.getByText('New Order Placed')).toBeInTheDocument();
    expect(screen.getByText('New Review Submitted')).toBeInTheDocument();

    // Verify native <a href="..."> tag for full-page Filament navigation
    const orderLink = screen.getByText('New Order Placed').closest('a');
    expect(orderLink).toHaveAttribute('href', 'http://localhost:8000/admin/orders/1042');

    const customerLink = screen.getByText('New Customer Registered').closest('a');
    expect(customerLink).toHaveAttribute('href', 'http://localhost:8000/admin/users/1/edit');
  });

  it('marks single notification as read when clicking an unread item', async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce(mockNotificationsResponse);
    vi.mocked(fetchJson).mockResolvedValueOnce({ success: true });

    renderBell();

    const bellBtn = screen.getByRole('button', { name: /notification/i });
    fireEvent.click(bellBtn);

    await waitFor(() => {
      expect(screen.getByText('New Customer Registered')).toBeInTheDocument();
    });

    const customerLink = screen.getByText('New Customer Registered').closest('a');
    expect(customerLink).not.toBeNull();
    fireEvent.click(customerLink!);

    await waitFor(() => {
      expect(fetchJson).toHaveBeenCalledWith('/admin/notifications/notif-1/read', {
        method: 'PATCH',
      });
    });
  });

  it('marks single notification as read when clicking the inline checkmark button', async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce(mockNotificationsResponse);
    vi.mocked(fetchJson).mockResolvedValueOnce({ success: true });

    renderBell();

    const bellBtn = screen.getByRole('button', { name: /notification/i });
    fireEvent.click(bellBtn);

    await waitFor(() => {
      expect(screen.getByText('New Customer Registered')).toBeInTheDocument();
    });

    const checkButtons = screen.getAllByRole('button', { name: /mark as read/i });
    expect(checkButtons.length).toBeGreaterThan(0);
    fireEvent.click(checkButtons[0]);

    await waitFor(() => {
      expect(fetchJson).toHaveBeenCalledWith('/admin/notifications/notif-1/read', {
        method: 'PATCH',
      });
    });
  });

  it('marks all notifications as read when clicking Mark all as read', async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce(mockNotificationsResponse);
    vi.mocked(fetchJson).mockResolvedValueOnce({ success: true });

    renderBell();

    const bellBtn = screen.getByRole('button', { name: /notification/i });
    fireEvent.click(bellBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /mark all as read/i })).toBeInTheDocument();
    });

    const markAllBtn = screen.getByRole('button', { name: /mark all as read/i });
    fireEvent.click(markAllBtn);

    await waitFor(() => {
      expect(fetchJson).toHaveBeenCalledWith('/admin/notifications/read-all', {
        method: 'POST',
      });
    });
  });

  it('displays empty state when there are no notifications', async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce({
      data: [],
      meta: { current_page: 1, last_page: 1, per_page: 20, total: 0, unread_count: 0 },
    });

    renderBell();

    const bellBtn = screen.getByRole('button', { name: /notification/i });
    fireEvent.click(bellBtn);

    await waitFor(() => {
      expect(screen.getByText(/no notifications yet/i)).toBeInTheDocument();
    });
  });

  it('closes dropdown on Escape key', async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce(mockNotificationsResponse);

    renderBell();

    const bellBtn = screen.getByRole('button', { name: /notification/i });
    fireEvent.click(bellBtn);

    await waitFor(() => {
      expect(screen.getByText('New Customer Registered')).toBeInTheDocument();
    });

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByText('New Customer Registered')).not.toBeInTheDocument();
    });
  });
});
