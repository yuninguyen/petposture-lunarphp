import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import { ProductKindMultiSelect, kindOf, type ProductForSelect } from './ProductKindMultiSelect';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PICK_A: ProductForSelect = { id: 2, name: 'Necoichi Tilted Elevated Bowl', pick: { retailer: 'chewy' } };
const PICK_B: ProductForSelect = { id: 3, name: 'Fun Feeder Slo Bowl', pick: { retailer: 'amazon' } };
const SHOP: ProductForSelect = { id: 40, name: 'Own Brand Harness', pick: null };

let host: HTMLDivElement;
let root: Root;
let latest: number[] = [];

function Harness({ initial = [] as number[] }) {
  const [value, setValue] = useState<number[]>(initial);
  latest = value;

  return createElement(ProductKindMultiSelect, { products: [PICK_A, PICK_B, SHOP], value, onChange: setValue });
}

const mount = (props: object = {}) => act(() => root.render(createElement(Harness, props)));
const filterButton = (key: string) => [...host.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].find((b) => b.textContent!.startsWith(`product_picker.kind.${key}`))!;
const listedNames = () => [...host.querySelectorAll('label span')].map((span) => span.textContent);

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  latest = [];
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('ProductKindMultiSelect', () => {
  it('tells a Pick (has a retailer link) from a shop product', () => {
    expect(kindOf(PICK_A)).toBe('pick');
    expect(kindOf(SHOP)).toBe('shop');
    expect(kindOf({ id: 1 })).toBe('shop');
  });

  it('starts on All, with the number of products of each kind on the buttons', () => {
    mount();

    expect(filterButton('all').getAttribute('aria-pressed')).toBe('true');
    expect(filterButton('all').textContent).toContain('(3)');
    expect(filterButton('pick').textContent).toContain('(2)');
    expect(filterButton('shop').textContent).toContain('(1)');
    expect(listedNames()).toHaveLength(3);
  });

  it('Picks shows only the Picks, Shop only the shop products', () => {
    mount();

    act(() => filterButton('pick').click());
    expect(listedNames()).toEqual(['Necoichi Tilted Elevated Bowl', 'Fun Feeder Slo Bowl']);
    expect(filterButton('pick').getAttribute('aria-pressed')).toBe('true');

    act(() => filterButton('shop').click());
    expect(listedNames()).toEqual(['Own Brand Harness']);

    act(() => filterButton('all').click());
    expect(listedNames()).toHaveLength(3);
  });

  it('keeps ticked products ticked when the filter hides them, and ticking under a filter adds to them', () => {
    mount({ initial: [40] });

    act(() => filterButton('pick').click());
    expect(latest).toEqual([40]);

    act(() => host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    expect(latest).toEqual([40, 2]);
  });
});
