import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import type { ProductSummary } from './api';

const mocks = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));

import { ProductRowActions } from './ProductRowActions';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const product: ProductSummary = {
  id: 42,
  thumbnail: null,
  name: 'Posture Bowl',
  description: '',
  product_type: { id: 1, name: 'General' },
  brand: null,
  first_collection: null,
  total_stock: 3,
  price: null,
  status: 'draft',
  created_at: null,
  updated_at: null,
};

describe('ProductRowActions', () => {
  it('keeps edit and delete inside the three-dot menu', () => {
    mocks.navigate.mockClear();
    const onDelete = vi.fn();
    const host = document.createElement('div');
    const root = createRoot(host);
    act(() => root.render(createElement(ProductRowActions, { product, onDelete })));

    expect(host.textContent).not.toContain('common.edit');
    expect(host.textContent).not.toContain('common.delete');
    const trigger = host.querySelector('button[aria-label="products.action_more"]') as HTMLButtonElement;
    act(() => trigger.click());
    expect(host.textContent).toContain('common.edit');
    expect(host.textContent).toContain('common.delete');

    const edit = Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.includes('common.edit'))!;
    act(() => edit.click());
    expect(mocks.navigate).toHaveBeenCalledWith('/products/42');
    expect(host.textContent).not.toContain('common.delete');

    act(() => trigger.click());
    const remove = Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.includes('common.delete'))!;
    act(() => remove.click());
    expect(onDelete).toHaveBeenCalledWith(product);

    act(() => root.unmount());
  });
});
