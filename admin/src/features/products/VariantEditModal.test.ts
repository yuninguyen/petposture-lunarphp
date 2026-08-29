import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { VariantEditModal } from './VariantEditModal';
import type { ProductVariant } from './api';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const variant: ProductVariant = {
  id: 1,
  product_id: 10,
  sku: 'SINGLE-001',
  gtin: null,
  mpn: null,
  ean: null,
  stock: 5,
  backorder: 0,
  purchasable: 'always',
  unit_quantity: 1,
  quantity_increment: 1,
  min_quantity: 1,
  tax_class_id: 2,
  tax_ref: null,
  shippable: true,
  length_value: null,
  length_unit: null,
  width_value: null,
  width_unit: null,
  height_value: null,
  height_unit: null,
  weight_value: null,
  weight_unit: null,
  base_price: '10000',
  formatted_price: '10,000 VND',
  has_order_history: false,
  option_values: [],
  attributes: [],
};

function renderEditor(inline: boolean) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const onSave = vi.fn().mockResolvedValue(undefined);

  act(() => {
    root.render(createElement(VariantEditModal, {
      variant,
      taxClasses: [{ id: 2, name: 'Default' }],
      isSaving: false,
      onClose: vi.fn(),
      onSave,
      inline,
    }));
  });

  return { host, root, onSave };
}

describe('VariantEditModal display modes', () => {
  it('renders inline fields without a modal overlay or nested form', () => {
    const { host, root } = renderEditor(true);

    expect(host.querySelector('.fixed')).toBeNull();
    expect(host.querySelector('form')).toBeNull();
    expect(host.textContent).toContain('products.pricing_inventory');

    act(() => root.unmount());
    host.remove();
  });

  it('submits valid pricing values from the inline editor', async () => {
    const { host, root, onSave } = renderEditor(true);
    const save = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'common.save')!;

    await act(async () => save.click());

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ sku: 'SINGLE-001', base_price: '10000', stock: 5 }));
    act(() => root.unmount());
    host.remove();
  });

  it('preserves the modal form for products with multiple variants', () => {
    const { host, root } = renderEditor(false);

    expect(host.querySelector('.fixed')).not.toBeNull();
    expect(host.querySelector('form')).not.toBeNull();

    act(() => root.unmount());
    host.remove();
  });
});
