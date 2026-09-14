import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { SystemUsersPage } from './SystemUsersPage';
import type { SystemUser } from './api';

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({ default: toast }));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, fetchJson: vi.fn() };
});

import { fetchJson } from '@/lib/api';

const mockUsers: SystemUser[] = [
  {
    id: 1,
    name: 'Super Admin',
    email: 'superadmin@example.com',
    is_active: true,
    roles: ['super_admin'],
    last_login_at: '2026-09-14T10:00:00Z',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-14T10:00:00Z',
  },
  {
    id: 2,
    name: 'John Staff',
    email: 'john.staff@example.com',
    is_active: false,
    roles: ['staff', 'Support'],
    last_login_at: null,
    created_at: '2026-09-05T00:00:00Z',
    updated_at: '2026-09-05T00:00:00Z',
  },
];

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  );
}

describe('SystemUsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchJson).mockImplementation(async (url, options) => {
      if (typeof url === 'string' && url.includes('/admin/system/users')) {
        if (options?.method === 'DELETE') {
          return {} as unknown;
        }
        return { data: mockUsers } as unknown;
      }
      return {} as unknown;
    });
  });

  it('renders user table with name, email, roles, and status', async () => {
    renderWithClient(<SystemUsersPage />);

    expect(await screen.findByText('Super Admin')).toBeInTheDocument();
    expect(screen.getByText('superadmin@example.com')).toBeInTheDocument();
    expect(screen.getByText('John Staff')).toBeInTheDocument();
    expect(screen.getByText('john.staff@example.com')).toBeInTheDocument();

    // Roles
    expect(screen.getByText('super_admin')).toBeInTheDocument();
    expect(screen.getByText('staff')).toBeInTheDocument();
    expect(screen.getByText('Support')).toBeInTheDocument();

    // Status
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('filters users via the search input by name or role', async () => {
    renderWithClient(<SystemUsersPage />);

    await screen.findByText('Super Admin');
    const searchInput = screen.getByPlaceholderText(/Search users by name/i);

    // Search for "Staff"
    fireEvent.change(searchInput, { target: { value: 'Staff' } });
    expect(screen.getByText('John Staff')).toBeInTheDocument();
    expect(screen.queryByText('Super Admin')).not.toBeInTheDocument();

    // Search for role "Support"
    fireEvent.change(searchInput, { target: { value: 'Support' } });
    expect(screen.getByText('John Staff')).toBeInTheDocument();
    expect(screen.queryByText('Super Admin')).not.toBeInTheDocument();

    // Search with no results
    fireEvent.change(searchInput, { target: { value: 'NonExistent' } });
    expect(screen.getByText(/No users found/i)).toBeInTheDocument();
  });

  it('opens the create user modal when New User button is clicked', async () => {
    renderWithClient(<SystemUsersPage />);

    await screen.findByText('Super Admin');
    const newBtn = screen.getByRole('button', { name: /New User/i });
    fireEvent.click(newBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('New System User')).toBeInTheDocument();
  });

  it('shows error toast with CANNOT_MODIFY_SELF message when trying to delete own account', async () => {
    const error = new Error('You cannot disable or delete your own account.') as Error & {
      status?: number;
      data?: { code?: string; message?: string };
    };
    error.status = 409;
    error.data = {
      code: 'CANNOT_MODIFY_SELF',
      message: 'You cannot disable or delete your own account.',
    };

    vi.mocked(fetchJson).mockImplementation(async (url, options) => {
      if (typeof url === 'string' && url.includes('/admin/system/users')) {
        if (options?.method === 'DELETE') {
          throw error;
        }
        return { data: mockUsers } as unknown;
      }
      return {} as unknown;
    });

    renderWithClient(<SystemUsersPage />);

    await screen.findByText('Super Admin');
    const actionButtons = screen.getAllByLabelText('Actions');
    fireEvent.click(actionButtons[0]);

    const deleteBtn = screen.getByText('Delete');
    fireEvent.click(deleteBtn);

    // Modal opens
    expect(screen.getByText('Delete System User')).toBeInTheDocument();
    const confirmBtn = screen.getByRole('button', { name: /^Delete$/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'You cannot disable or delete your own account.'
      );
    });
  });

  it('shows error toast with LAST_SUPER_ADMIN message when trying to delete last super admin', async () => {
    const error = new Error('Cannot remove the last active super admin.') as Error & {
      status?: number;
      data?: { code?: string; message?: string };
    };
    error.status = 409;
    error.data = {
      code: 'LAST_SUPER_ADMIN',
      message: 'Cannot remove the last active super admin.',
    };

    vi.mocked(fetchJson).mockImplementation(async (url, options) => {
      if (typeof url === 'string' && url.includes('/admin/system/users')) {
        if (options?.method === 'DELETE') {
          throw error;
        }
        return { data: mockUsers } as unknown;
      }
      return {} as unknown;
    });

    renderWithClient(<SystemUsersPage />);

    await screen.findByText('Super Admin');
    const actionButtons = screen.getAllByLabelText('Actions');
    fireEvent.click(actionButtons[0]);

    const deleteBtn = screen.getByText('Delete');
    fireEvent.click(deleteBtn);

    const confirmBtn = screen.getByRole('button', { name: /^Delete$/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Cannot remove the last active super admin.'
      );
    });
  });

  it('successfully deletes a user and shows success toast', async () => {
    renderWithClient(<SystemUsersPage />);

    await screen.findByText('John Staff');
    const actionButtons = screen.getAllByLabelText('Actions');
    fireEvent.click(actionButtons[1]); // John Staff

    const deleteBtn = screen.getByText('Delete');
    fireEvent.click(deleteBtn);

    const confirmBtn = screen.getByRole('button', { name: /^Delete$/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(fetchJson).toHaveBeenCalledWith('/admin/system/users/2', {
        method: 'DELETE',
      });
      expect(toast.success).toHaveBeenCalledWith('User deleted successfully');
    });
  });
});
