import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key) }) }));

import { RelatedProductsField, pickOptionLabel } from './RelatedProductsField';
import type { PickOption } from './postsApi';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NECOICHI: PickOption = { id: 2, name: 'Necoichi Tilted Elevated Bowl', brand: 'Necoichi', reference_price: 25.99, thumbnail: 'https://cdn.example.test/n.webp' };
const SLO: PickOption = { id: 3, name: 'Fun Feeder Slo Bowl', brand: 'Outward Hound', reference_price: 8.51, thumbnail: null };
const NO_PRICE: PickOption = { id: 4, name: 'Mystery Harness', brand: null, reference_price: null, thumbnail: null };

let host: HTMLDivElement;
let root: Root;
let latest: number[] = [];

function Harness({ initial = [] as number[], options = [NECOICHI, SLO, NO_PRICE], ready = true }) {
  const [value, setValue] = useState<number[]>(initial);
  latest = value;

  return createElement(RelatedProductsField, { options, value, onChange: setValue, ready });
}

const mount = (props: object = {}) => act(() => root.render(createElement(Harness, props)));
const type = (value: string) => {
  const input = host.querySelector<HTMLInputElement>('input:not([type="checkbox"])')!;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

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

describe('RelatedProductsField', () => {
  it('labels an option with brand, name and reference price, leaving out what is missing', () => {
    expect(pickOptionLabel(NECOICHI)).toBe('Necoichi — Necoichi Tilted Elevated Bowl · $25.99');
    expect(pickOptionLabel(NO_PRICE)).toBe('Mystery Harness');
  });

  it('lists the picks and finds them by name or by brand', () => {
    mount();
    expect(host.querySelectorAll('input[type="checkbox"]')).toHaveLength(3);

    type('outward');
    expect(host.textContent).toContain('Fun Feeder Slo Bowl');
    expect(host.textContent).not.toContain('Necoichi Tilted');

    type('necoichi');
    expect(host.textContent).toContain('Necoichi Tilted Elevated Bowl');
    expect(host.textContent).not.toContain('Fun Feeder');
  });

  it('ticks picks, counts them, and shows each one as a chip with its photo', () => {
    mount();
    const boxes = host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    act(() => boxes[0].click());
    act(() => boxes[1].click());

    expect(latest).toEqual([2, 3]);
    expect(host.textContent).toContain('posts.related_products.selected {"count":2}');
    expect(host.querySelector('img[src="https://cdn.example.test/n.webp"]')).not.toBeNull();
  });

  it('removes a pick with the cross on its chip', () => {
    mount({ initial: [2, 3] });
    act(() => host.querySelector<HTMLButtonElement>('button[aria-label^="posts.related_products.remove"]')!.click());

    expect(latest).toEqual([3]);
  });

  it('keeps a link to a pick that is no longer published as a chip that can be removed', () => {
    mount({ initial: [99], options: [NECOICHI] });

    expect(host.textContent).toContain('posts.related_products.unavailable {"id":99}');
    act(() => host.querySelector<HTMLButtonElement>('button[aria-label^="posts.related_products.remove"]')!.click());
    expect(latest).toEqual([]);
  });

  it('does not call a chosen pick "not published" while the list of picks is still loading', () => {
    mount({ initial: [99], options: [], ready: false });
    expect(host.textContent).not.toContain('posts.related_products.unavailable');

    mount({ initial: [99], options: [], ready: true });
    expect(host.textContent).toContain('posts.related_products.unavailable {"id":99}');
  });

  it('shows no chips and a zero count while nothing is chosen', () => {
    mount();

    expect(host.textContent).toContain('posts.related_products.selected {"count":0}');
    expect(host.querySelector('button[aria-label^="posts.related_products.remove"]')).toBeNull();
  });
});
