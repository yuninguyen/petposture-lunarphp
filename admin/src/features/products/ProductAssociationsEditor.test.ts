import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  create: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('./api', () => ({
  useProductAssociations: () => ({ isLoading: false, data: [{ id: 7, type: 'cross-sell', target: { id: 2, name: 'Existing target', status: 'published', slug: 'existing', thumbnail: null } }] }),
  useProducts: () => ({ isLoading: false, data: { data: [
    { id: 1, name: 'Current product', status: 'draft', thumbnail: null, product_type: { id: 1, name: 'General' } },
    { id: 3, name: 'Candidate product', status: 'published', thumbnail: null, product_type: { id: 1, name: 'General' } },
  ] } }),
  useCreateProductAssociation: () => ({ isPending: false, mutateAsync: mocks.create }),
  useDeleteProductAssociation: () => ({ isPending: false, mutateAsync: mocks.remove }),
}));

import { ProductAssociationsEditor } from './ProductAssociationsEditor';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderEditor() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(createElement(ProductAssociationsEditor, { productId: 1 })));
  return { host, root };
}

describe('ProductAssociationsEditor', () => {
  it('searches a target and creates a typed association', async () => {
    mocks.create.mockClear();
    const { host, root } = renderEditor();
    const input = host.querySelector('input') as HTMLInputElement;

    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, 'Candidate');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const candidate = Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.includes('Candidate product'))!;
    act(() => candidate.click());
    const add = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'products.add_association')!;
    await act(async () => add.click());

    expect(mocks.create).toHaveBeenCalledWith({ productId: 1, targetProductId: 3, type: 'cross-sell' });
    act(() => root.unmount());
    host.remove();
  });

  it('confirms removal of an existing association', async () => {
    mocks.remove.mockClear();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { host, root } = renderEditor();
    const remove = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'common.remove')!;

    await act(async () => remove.click());

    expect(confirm).toHaveBeenCalled();
    expect(mocks.remove).toHaveBeenCalledWith({ productId: 1, associationId: 7 });
    confirm.mockRestore();
    act(() => root.unmount());
    host.remove();
  });
});
