// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShippingInfoModal } from './ShippingInfoModal';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;

function render(open: boolean, onClose = vi.fn()) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root!.render(<ShippingInfoModal open={open} onClose={onClose} />));
    return { onClose, host };
}

afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    root = null;
    host = null;
});

describe('ShippingInfoModal', () => {
    it('renders nothing while closed', () => {
        const { host } = render(false);
        expect(host.textContent).toBe('');
    });

    it('shows the shipping information with a link to the full policy', () => {
        const { host } = render(true);

        expect(host.textContent).toContain('48 contiguous United States');
        expect(host.querySelector('a[href="/shipping-policy"]')).not.toBeNull();
    });

    it('closes from the close button and from the backdrop, but not from a click inside the panel', () => {
        const { host, onClose } = render(true);

        act(() => (host.querySelector('h3') as HTMLElement).click());
        expect(onClose).not.toHaveBeenCalled();

        act(() => (host.querySelector('[aria-label="Close"]') as HTMLButtonElement).click());
        expect(onClose).toHaveBeenCalledTimes(1);

        act(() => (host.firstElementChild as HTMLElement).click());
        expect(onClose).toHaveBeenCalledTimes(2);
    });
});
