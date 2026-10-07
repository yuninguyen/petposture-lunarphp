// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { ShippingSummaryRow } from './ShippingSummaryRow';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;

function render(props: { amount: string; method?: string | null }) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root!.render(<ShippingSummaryRow {...props} />));
    return host;
}

afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    root = null;
    host = null;
});

describe('ShippingSummaryRow', () => {
    it('shows the label, the chosen shipping method (without repeating "Shipping") and the amount on one line', () => {
        const row = render({ amount: '$15.00', method: 'Standard Shipping' });

        expect(row.textContent).toContain('Shipping (Standard)');
        expect(row.textContent).not.toContain('Standard Shipping');
        expect(row.textContent).toContain('$15.00');
        expect(row.querySelectorAll('p')).toHaveLength(0);

        act(() => root!.unmount());
        host!.remove();
        expect(render({ amount: '$25.00', method: 'Express Shipping' }).textContent).toContain('Shipping (Express)');
    });

    it('shows just Shipping when there is no method', () => {
        const row = render({ amount: 'Free' });

        expect(row.textContent).toContain('Shipping');
        expect(row.textContent).not.toContain('(');
        expect(row.textContent).toContain('Free');
    });

    it('opens the shipping information from the help icon', () => {
        const row = render({ amount: '$15.00', method: 'Standard Shipping' });
        expect(row.textContent).not.toContain('48 contiguous United States');

        act(() => (row.querySelector('[aria-label="Shipping details"]') as HTMLButtonElement).click());

        expect(row.textContent).toContain('48 contiguous United States');
    });
});
