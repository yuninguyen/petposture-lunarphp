import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { RolesPage } from './RolesPage';
import type { RolesResponse } from './api';

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

const mockRolesResponse: RolesResponse = {
  data: [
    { id: 1, name: 'super_admin', editable: false, permissions: ['view_any_product', 'view_any_order'] },
    { id: 2, name: 'admin', editable: false, permissions: ['view_any_product', 'view_any_order'] },
    { id: 3, name: 'staff', editable: false, permissions: ['view_any_product', 'view_any_order'] },
    { id: 4, name: 'Product Manager', editable: true, permissions: ['view_any_product', 'publish_product'] },
    { id: 5, name: 'Order Manager', editable: true, permissions: ['view_any_order', 'update_order'] },
    { id: 6, name: 'Support', editable: true, permissions: ['view_any_order'] },
  ],
  permission_groups: {
    PRODUCT: ['view_any_product', 'publish_product'],
    ORDER: ['view_any_order', 'update_order', 'refund_order'],
    REVIEW: ['view_any_review'],
    POST: ['view_any_post'],
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
      <BrowserRouter>
        <RolesPage />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe('RolesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all 6 roles with correct titles, badges, and displays full access for core roles', async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce(mockRolesResponse);

    renderPage();

    expect(screen.getByText('Loading roles...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Super Admin')).toBeInTheDocument();
    });

    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Staff')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Product Manager' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Order Manager' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Support' })).toBeInTheDocument();

    // 3 core roles have "Full access" badge
    const fullAccessBadges = screen.getAllByText('Full access');
    expect(fullAccessBadges).toHaveLength(3);

    // Only the 3 business roles have "Edit permissions" button
    const editButtons = screen.getAllByRole('button', { name: /Edit permissions/i });
    expect(editButtons).toHaveLength(3);
  });

  it('core admin roles do not have an Edit permissions button', async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce(mockRolesResponse);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Super Admin')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByRole('button', { name: /Edit permissions/i });
    expect(editButtons).toHaveLength(3);
  });

  it('clicking Edit permissions opens modal with 4 permission groups', async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce(mockRolesResponse);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Order Manager' })).toBeInTheDocument();
    });

    const editButtons = screen.getAllByRole('button', { name: /Edit permissions/i });
    // Click edit on Order Manager (second business role -> index 1)
    fireEvent.click(editButtons[1]);

    // Modal opens
    expect(screen.getByText('Edit Permissions: Order Manager')).toBeInTheDocument();

    // Contains all 4 group headings
    expect(screen.getByText('Product')).toBeInTheDocument();
    expect(screen.getByText('Order')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
    expect(screen.getByText('Post')).toBeInTheDocument();

    // Checkboxes are rendered
    const viewAnyOrderCheckbox = screen.getByLabelText(/View Any Order/i);
    expect(viewAnyOrderCheckbox).toBeChecked();

    const refundOrderCheckbox = screen.getByLabelText(/Refund Order/i);
    expect(refundOrderCheckbox).not.toBeChecked();
  });

  it('select all and deselect all buttons work in a group', async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce(mockRolesResponse);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Order Manager' })).toBeInTheDocument();
    });

    const editButtons = screen.getAllByRole('button', { name: /Edit permissions/i });
    fireEvent.click(editButtons[1]);

    // In Order group, click "Select all" (2nd group)
    const selectAllButtons = screen.getAllByRole('button', { name: /^Select all$/i });
    fireEvent.click(selectAllButtons[1]); // Order group

    const refundOrderCheckbox = screen.getByLabelText(/Refund Order/i);
    expect(refundOrderCheckbox).toBeChecked();

    // Click "Deselect all" in Order group
    const deselectAllButtons = screen.getAllByRole('button', { name: /^Deselect all$/i });
    fireEvent.click(deselectAllButtons[1]);

    expect(refundOrderCheckbox).not.toBeChecked();
    expect(screen.getByLabelText(/View Any Order/i)).not.toBeChecked();
  });

  it('saving permissions calls API and shows success toast', async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce(mockRolesResponse);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Order Manager' })).toBeInTheDocument();
    });

    const editButtons = screen.getAllByRole('button', { name: /Edit permissions/i });
    fireEvent.click(editButtons[1]); // Order Manager (id 5)

    // Toggle refund_order
    const refundOrderCheckbox = screen.getByLabelText(/Refund Order/i);
    fireEvent.click(refundOrderCheckbox);
    expect(refundOrderCheckbox).toBeChecked();

    // Mock PUT response
    vi.mocked(fetchJson).mockResolvedValueOnce({
      data: {
        id: 5,
        name: 'Order Manager',
        editable: true,
        permissions: ['view_any_order', 'update_order', 'refund_order'],
      },
    });

    // Also mock query invalidation refetch
    vi.mocked(fetchJson).mockResolvedValueOnce(mockRolesResponse);

    const saveButton = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(fetchJson).toHaveBeenCalledWith('/admin/system/roles/5', {
        method: 'PUT',
        body: {
          permissions: expect.arrayContaining(['view_any_order', 'update_order', 'refund_order']),
        },
      });
    });

    expect(toast.success).toHaveBeenCalledWith('Permissions updated successfully');
  });

  it('handles 422 error and displays validation error in modal and toast', async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce(mockRolesResponse);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Order Manager' })).toBeInTheDocument();
    });

    const editButtons = screen.getAllByRole('button', { name: /Edit permissions/i });
    fireEvent.click(editButtons[1]);

    const error = Object.assign(new Error('The given data was invalid.'), {
      status: 422,
      data: {
        message: 'The given data was invalid.',
        errors: {
          'permissions.0': ['The selected permission is invalid.'],
        },
      },
    });

    vi.mocked(fetchJson).mockRejectedValueOnce(error);

    const saveButton = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('The selected permission is invalid.');
    });

    expect(screen.getByText('The selected permission is invalid.')).toBeInTheDocument();
  });

  it('renders domain groups with new array structure and allows searching by domain or ability', async () => {
    const domainGroupResponse: RolesResponse = {
      data: [
        { id: 4, name: 'Product Manager', editable: true, permissions: ['view_any_brand', 'view_any_customer'] },
        { id: 6, name: 'Support', editable: true, permissions: ['view_any_customer'] },
      ],
      permission_groups: [
        {
          key: 'brands',
          label: 'Brands',
          abilities: ['view_any_brand', 'create_brand', 'update_brand'],
        },
        {
          key: 'customers',
          label: 'Customers',
          abilities: ['view_any_customer', 'update_customer'],
        },
        {
          key: 'orders',
          label: 'Orders',
          abilities: ['view_any_order', 'update_order'],
        },
      ],
    };

    vi.mocked(fetchJson).mockResolvedValueOnce(domainGroupResponse);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Product Manager' })).toBeInTheDocument();
    });

    // Domain badges on card
    expect(screen.getByText(/Brands:\s*1\/3/)).toBeInTheDocument();
    expect(screen.getAllByText(/Customers:\s*1\/2/)).toHaveLength(2);

    const editButtons = screen.getAllByRole('button', { name: /Edit permissions/i });
    fireEvent.click(editButtons[0]);

    // Modal shows all 3 groups
    expect(screen.getByText('Brands')).toBeInTheDocument();
    expect(screen.getByText('Customers')).toBeInTheDocument();
    expect(screen.getByText('Orders')).toBeInTheDocument();

    // Search filter
    const searchInput = screen.getByPlaceholderText(/Search domains or abilities.../i);
    fireEvent.change(searchInput, { target: { value: 'Customer' } });

    // Only Customers group remains visible
    expect(screen.getByText('Customers')).toBeInTheDocument();
    expect(screen.queryByText('Brands')).not.toBeInTheDocument();
    expect(screen.queryByText('Orders')).not.toBeInTheDocument();
  });
});
