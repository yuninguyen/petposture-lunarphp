import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExpressCheckout } from './ExpressCheckout';

const baseProps = {
    items: [{ variantId: 1, quantity: 1 }],
    couponCode: null,
    subtotalMinor: 2000,
    stripeInstance: null,
    paypalClientId: null,
    onOrderPlaced: vi.fn(),
};

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function render(ui: React.ReactNode) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root?.render(ui));
    return container;
}

afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    root = null;
    container = null;
});

describe('ExpressCheckout', () => {
    it('renders nothing when no wallet method is available', () => {
        const element = render(<ExpressCheckout {...baseProps} />);
        expect(element.childElementCount).toBe(0);
    });

    it('does not show the express checkout label just because a stripeInstance prop is present', () => {
        const element = render(<ExpressCheckout {...baseProps} stripeInstance={{} as never} />);
        expect(element.textContent).not.toContain('Express checkout');
    });
});
