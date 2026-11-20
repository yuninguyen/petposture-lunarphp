import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import { ProductCreateModal } from './ProductCreateModal';

const productTypes = [{ id: 1, name: 'General' }, { id: 2, name: 'Harnesses' }] as never;

function mount(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  const view = render(<ProductCreateModal open productTypes={productTypes} isSaving={false} onClose={vi.fn()} onSubmit={onSubmit} />);

  return { ...view, onSubmit };
}

const field = (name: string) => document.querySelector(`[name="${name}"]`) as HTMLInputElement | HTMLSelectElement | null;
const fill = (name: string, value: string) => fireEvent.change(field(name)!, { target: { value } });

function fillBasics() {
  fill('name', 'KONG Puppy');
  fill('product_type_id', '1');
  fill('sku', 'KONG-1');
  fill('base_price', '7.46');
}

const submit = () => fireEvent.submit(document.querySelector('form')!);

describe('ProductCreateModal Kind', () => {
  afterEach(() => cleanup());

  it('has a Kind dropdown with Pick and Shop, Pick first and chosen at the start, and shows the retailer link', () => {
    mount();

    const kind = field('kind') as HTMLSelectElement;

    expect([...kind.options].map((option) => option.value)).toEqual(['pick', 'shop']);
    expect(kind.value).toBe('pick');
    expect(field('external_url')).not.toBeNull();
    expect(document.body.textContent).toContain('products.kind_help_pick');
  });

  it('keeps the four fields it always had, and Product type stays separate from Kind', () => {
    mount();

    for (const name of ['name', 'product_type_id', 'sku', 'base_price']) expect(field(name)).not.toBeNull();
    expect(document.body.textContent).toContain('products.product_type');
    expect(document.body.textContent).toContain('products.kind');
  });

  it('hides the retailer link when Shop is chosen and brings it back for Pick', async () => {
    mount();

    fill('kind', 'shop');
    await waitFor(() => expect(field('external_url')).toBeNull());
    expect(document.body.textContent).toContain('products.kind_help_shop');

    fill('kind', 'pick');
    await waitFor(() => expect(field('external_url')).not.toBeNull());
  });

  it('does not create a Pick without a web retailer link', async () => {
    const { onSubmit } = mount();
    fillBasics();

    submit();
    await waitFor(() => expect(document.body.textContent).toContain('products.validation.pick_link_required'));
    expect(onSubmit).not.toHaveBeenCalled();

    fill('external_url', 'chewy.com/a');
    submit();
    await waitFor(() => expect(document.body.textContent).toContain('products.validation.pick_link_invalid'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('creates a Pick with its link', async () => {
    const { onSubmit } = mount();
    fillBasics();
    fill('external_url', '  https://www.chewy.com/kong/dp/1  ');

    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ kind: 'pick', external_url: 'https://www.chewy.com/kong/dp/1', name: 'KONG Puppy', sku: 'KONG-1' });
  });

  it('creates a Shop product without any link, even if one was typed before switching', async () => {
    const { onSubmit } = mount();
    fillBasics();
    fill('external_url', 'https://www.chewy.com/kong/dp/1');
    fill('kind', 'shop');

    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ kind: 'shop', external_url: '' });
  });
});
