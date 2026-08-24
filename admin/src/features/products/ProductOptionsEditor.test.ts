import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { ProductOptionsEditor } from './ProductOptionsEditor';
import type { ProductVariant } from './api';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, values?: { count?: number }) => values?.count == null ? key : `${key}:${values.count}` }) }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function variant(id: number, history = false): ProductVariant {
  return {
    id,
    product_id: 10,
    sku: `SKU-${id}`,
    gtin: null,
    mpn: null,
    ean: null,
    stock: 1,
    backorder: 0,
    purchasable: 'always',
    unit_quantity: 1,
    quantity_increment: 1,
    min_quantity: 1,
    tax_class_id: 1,
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
    base_price: '10.00',
    formatted_price: '$10.00',
    has_order_history: history,
    option_values: [],
    attributes: [],
  };
}

function renderEditor(variants: ProductVariant[]) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const onDeleteVariant = vi.fn().mockResolvedValue(undefined);
  const props = {
    options: [{ id: 1, name: 'Color', shared: false, values: [{ id: 11, name: 'Red' }, { id: 12, name: 'Blue' }] }],
    variants,
    isSavingOptions: false,
    isGenerating: false,
    isDeleting: false,
    onSaveOptions: vi.fn().mockResolvedValue(undefined),
    onGenerate: vi.fn().mockResolvedValue(undefined),
    onEditVariant: vi.fn(),
    onDeleteVariant,
  };

  act(() => root.render(createElement(ProductOptionsEditor, props)));
  return { host, root, onDeleteVariant };
}

describe('ProductOptionsEditor', () => {
  it('shows projected count and order-history warning before allowing soft delete', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { host, root, onDeleteVariant } = renderEditor([variant(1, true), variant(2)]);

    expect(host.textContent).toContain('products.projected_variants:2');
    expect(host.textContent).toContain('products.variant_has_order_history');
    const deleteButtons = Array.from(host.querySelectorAll('button')).filter((button) => button.textContent === 'common.delete');

    await act(async () => deleteButtons[0].click());

    expect(confirm).toHaveBeenCalledWith('products.delete_variant_history_confirm');
    expect(onDeleteVariant).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
    confirm.mockRestore();
    act(() => root.unmount());
    host.remove();
  });

  it('disables generating until staged option changes are saved', () => {
    const { host, root } = renderEditor([variant(1), variant(2)]);
    const button = (label: string) => Array.from(host.querySelectorAll('button')).find((item) => item.textContent === label);

    expect(button('products.generate_variants')?.disabled).toBe(false);
    act(() => button('products.add_option_value')?.click());
    expect(button('products.generate_variants')?.disabled).toBe(true);
    expect(host.textContent).toContain('products.save_options_before_generate');

    act(() => root.unmount());
    host.remove();
  });

  it('disables deleting the final active variant', () => {
    const { host, root } = renderEditor([variant(1)]);
    const deleteButton = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'common.delete');

    expect(deleteButton?.disabled).toBe(true);

    act(() => root.unmount());
    host.remove();
  });
});
