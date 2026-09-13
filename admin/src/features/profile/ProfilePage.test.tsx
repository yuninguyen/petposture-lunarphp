import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProfilePage } from './ProfilePage';
import type { ProfileData } from './profileApi';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, fetchJson: vi.fn() };
});

import { fetchJson } from '@/lib/api';

const mockProfileData: ProfileData = {
  id: 1,
  name: 'Jane Doe',
  email: 'jane@petposture.test',
  role_labels: ['Order Manager'],
  joined_at: '2026-01-15T08:30:00.000000Z',
  last_login_at: '2026-09-13T10:15:00.000000Z',
  recent_activity: {
    scope: 'system',
    label: 'Recent system activity',
    items: [
      {
        id: 101,
        description: 'Order PP-1001 status changed to delivered',
        subject_type: 'Order',
        created_at: '2026-09-13T11:00:00.000000Z',
        created_at_human: '1 hour ago',
      },
    ],
  },
};

function mockGetProfile() {
  vi.mocked(fetchJson).mockImplementation(async () => ({ data: mockProfileData } as never));
}

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ProfilePage />
    </QueryClientProvider>
  );
}

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders user details, roles, joined date, and last login time', async () => {
    mockGetProfile();

    renderWithProviders();

    expect(screen.getByRole('status')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('Jane Doe')).toBeDefined();
    });

    expect(screen.getByText('jane@petposture.test')).toBeDefined();
    expect(screen.getByText(/Order Manager/i)).toBeDefined();
    // Verify last login display
    expect(screen.getByText(/Last login/i)).toBeDefined();
    // Verify joined date display
    expect(screen.getByText(/Member since/i)).toBeDefined();
  });

  it('clearly labels recent activity as system-wide (not personal)', async () => {
    mockGetProfile();

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText(/Recent system activity/i)).toBeDefined();
    });

    expect(screen.getByText(/Order PP-1001 status changed to delivered/i)).toBeDefined();
  });

  it('submits profile updates (name and email)', async () => {
    vi.mocked(fetchJson).mockImplementation(async (endpoint, options) => {
      if (endpoint === '/admin/profile' && options?.method === 'PUT') {
        return {
          data: {
            ...mockProfileData,
            name: 'Jane Smith',
            email: 'janesmith@petposture.test',
          },
        } as never;
      }
      return { data: mockProfileData } as never;
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByLabelText(/^Name$/i)).toBeDefined();
    });

    const nameInput = screen.getByLabelText(/^Name$/i);
    const emailInput = screen.getByLabelText(/^Email$/i);

    fireEvent.change(nameInput, { target: { value: 'Jane Smith' } });
    fireEvent.change(emailInput, { target: { value: 'janesmith@petposture.test' } });

    const saveButton = screen.getByRole('button', { name: /Save Profile/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(fetchJson).toHaveBeenCalledWith(
        '/admin/profile',
        expect.objectContaining({
          method: 'PUT',
          body: { name: 'Jane Smith', email: 'janesmith@petposture.test' },
        })
      );
    });
  });

  it('surfaces per-field validation errors on profile form', async () => {
    const error = Object.assign(new Error('Validation failed'), {
      status: 422,
      data: {
        message: 'The email has already been taken.',
        errors: {
          email: ['The email has already been taken.'],
        },
      },
    });

    vi.mocked(fetchJson).mockImplementation(async (endpoint, options) => {
      if (endpoint === '/admin/profile' && options?.method === 'PUT') {
        throw error;
      }
      return { data: mockProfileData } as never;
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByLabelText(/^Email$/i)).toBeDefined();
    });

    const saveButton = screen.getByRole('button', { name: /Save Profile/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('The email has already been taken.')).toBeDefined();
    });
  });

  it('submits password change and surfaces password validation errors', async () => {
    const error = Object.assign(new Error('Validation failed'), {
      status: 422,
      data: {
        message: 'The current password is incorrect.',
        errors: {
          current_password: ['The current password is incorrect.'],
        },
      },
    });

    vi.mocked(fetchJson).mockImplementation(async (endpoint, options) => {
      if (endpoint === '/admin/profile/password' && options?.method === 'PUT') {
        throw error;
      }
      return { data: mockProfileData } as never;
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByLabelText(/Current Password/i)).toBeDefined();
    });

    const currentPasswordInput = screen.getByLabelText(/Current Password/i);
    const newPasswordInput = screen.getByLabelText(/^New Password$/i);
    const confirmPasswordInput = screen.getByLabelText(/Confirm New Password/i);

    fireEvent.change(currentPasswordInput, { target: { value: 'wrongpass' } });
    fireEvent.change(newPasswordInput, { target: { value: 'newsecret123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'newsecret123' } });

    const changePasswordButton = screen.getByRole('button', { name: /Update Password/i });
    fireEvent.click(changePasswordButton);

    await waitFor(() => {
      expect(fetchJson).toHaveBeenCalledWith(
        '/admin/profile/password',
        expect.objectContaining({
          method: 'PUT',
          body: {
            current_password: 'wrongpass',
            password: 'newsecret123',
            password_confirmation: 'newsecret123',
          },
        })
      );
      expect(screen.getByText('The current password is incorrect.')).toBeDefined();
    });
  });
});
