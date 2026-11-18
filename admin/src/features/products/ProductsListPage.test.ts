import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useProducts: vi.fn(),
  bulkDelete: vi.fn().mockResolvedValue(undefined),
  bulkStatus: vi.fn().mockResolvedValue({ updated: 2 }),
}));

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('./ProductCreateModal', () => ({ ProductCreateModal: () => null }));
vi.mock('./ProductRowActions', () => ({ ProductRowActions: () => null }));
vi.mock('@/components/ui/delete-confirm-modal', () => ({ DeleteConfirmModal: ({ open, onConfirm }: { open: boolean; onConfirm: () => void }) => open ? createElement('button', { 'data-testid': 'confirm-delete', onClick: onConfirm }, 'confirm') : null }));
vi.mock('./api', () => ({
  useProducts: (filters: unknown) => (mocks.useProducts(filters), {
    isLoading: false,
    isError: false,
    data: {
      data: [
        { id: 1, thumbnail: 'https://cdn.example.com/first.jpg', name: 'First', description: 'Hidden product description', product_type: { id: 1, name: 'General' }, brand: null, first_collection: null, total_stock: 1, price: null, status: 'draft', kind: 'pick', created_at: null, updated_at: null },
        { id: 2, thumbnail: null, name: 'Second', description: '', product_type: { id: 1, name: 'General' }, brand: null, first_collection: null, total_stock: 2, price: null, status: 'published', kind: 'shop', created_at: null, updated_at: null },
      ],
      meta: { current_page: 1, last_page: 1, per_page: 15, total: 2 },
    },
  }),
  useProductLookups: () => ({ brands: [], productTypes: [], collectionOptions: [], isLoading: false }),
  useCreateProduct: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteProduct: () => ({ mutate: vi.fn(), isPending: false }),
  useBulkDeleteProducts: () => ({ mutateAsync: mocks.bulkDelete, isPending: false }),
  useBulkUpdateProductStatus: () => ({ mutateAsync: mocks.bulkStatus, isPending: false }),
}));

import { ProductsListPage } from './ProductsListPage';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderPage() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(createElement(ProductsListPage)));
  return { host, root };
}

function rowCheckboxes(host: HTMLElement): HTMLInputElement[] {
  return Array.from(host.querySelectorAll('input[type="checkbox"]')).slice(1) as HTMLInputElement[];
}

describe('ProductsListPage bulk actions', () => {
  it('does not render product thumbnails in the list', () => {
    const { host, root } = renderPage();

    expect(host.querySelector('tbody img')).toBeNull();
    expect(host.textContent).not.toContain('Hidden product description');
    expect(Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'First')?.className).toContain('text-left');

    act(() => root.unmount());
    host.remove();
  });

  it('selects rows and applies one status to all selected products', async () => {
    mocks.bulkStatus.mockClear();
    const { host, root } = renderPage();

    act(() => {
      rowCheckboxes(host)[0].click();
      rowCheckboxes(host)[1].click();
    });
    expect(host.textContent).toContain('products.selected_count');

    const statusSelect = Array.from(host.querySelectorAll('select')).find((select) => select.value === 'published' && Array.from(select.options).length === 2) as HTMLSelectElement;
    act(() => {
      statusSelect.value = 'draft';
      statusSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const apply = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'products.apply_status')!;
    await act(async () => apply.click());

    expect(mocks.bulkStatus).toHaveBeenCalledWith({ ids: [1, 2], status: 'draft' });
    act(() => root.unmount());
    host.remove();
  });

  it('selects the current page and confirms bulk deletion', async () => {
    mocks.bulkDelete.mockClear();
    const { host, root } = renderPage();
    const selectAll = host.querySelector('input[type="checkbox"]') as HTMLInputElement;

    act(() => selectAll.click());
    const remove = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'products.delete_selected')!;
    act(() => remove.click());
    const confirm = host.querySelector('[data-testid="confirm-delete"]') as HTMLButtonElement;
    await act(async () => confirm.click());

    expect(mocks.bulkDelete).toHaveBeenCalledWith([1, 2]);
    act(() => root.unmount());
    host.remove();
  });
});

function choose(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(select, value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('ProductsListPage Pick / Shop', () => {
  it('shows a Pick or Shop label on every row, in a column of its own beside the product name', () => {
    const { host, root } = renderPage();

    const headers = Array.from(host.querySelectorAll('thead th')).map((th) => th.textContent);
    expect(headers.slice(1, 4)).toEqual(['products.column_product', 'products.column_kind', 'products.column_product_type']);

    const rows = Array.from(host.querySelectorAll('tbody tr'));
    expect(rows[0].textContent).toContain('products.kind_pick');
    expect(rows[1].textContent).toContain('products.kind_shop');

    act(() => root.unmount());
    host.remove();
  });

  it('offers All kinds, Picks only and Shop only, and asks the server for the chosen kind from the first page', () => {
    mocks.useProducts.mockClear();
    const { host, root } = renderPage();
    const select = Array.from(host.querySelectorAll('select')).find((element) => element.textContent?.includes('products.kind_pick_only')) as HTMLSelectElement;

    expect(Array.from(select.options).map((option) => [option.value, option.textContent])).toEqual([
      ['', 'products.all_kinds'],
      ['pick', 'products.kind_pick_only'],
      ['shop', 'products.kind_shop_only'],
    ]);
    expect(mocks.useProducts).toHaveBeenLastCalledWith(expect.objectContaining({ kind: '' }));

    choose(select, 'pick');
    expect(mocks.useProducts).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'pick', page: 1 }));

    choose(select, 'shop');
    expect(mocks.useProducts).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'shop', page: 1 }));

    choose(select, '');
    expect(mocks.useProducts).toHaveBeenLastCalledWith(expect.objectContaining({ kind: '' }));

    act(() => root.unmount());
    host.remove();
  });
});
