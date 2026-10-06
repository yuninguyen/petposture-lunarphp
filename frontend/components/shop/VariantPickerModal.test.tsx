// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Product, ProductVariant } from '../../types/shop';
import { VariantPickerModal } from './VariantPickerModal';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const variant = (id: number, valueId: number, value: string, price: number, available = true): ProductVariant => ({
    id, sku: null, price, stock: available ? 3 : 0, available, image: null,
    options: [{ option: 'Size', valueId, value }],
});

const product = {
    id: 1, productId: 1, variantId: 10, slug: 'harness', name: 'Soft Harness', category: 'Harnesses', categorySlug: 'harness',
    price: 20, rating: 5, reviews: 1, image: '/harness.png',
    options: [{ id: 1, name: 'Size', handle: 'size', values: [{ id: 1, name: 'Small' }, { id: 2, name: 'Medium' }, { id: 3, name: 'Large' }] }],
    variants: [variant(10, 1, 'Small', 20), variant(11, 2, 'Medium', 25), variant(12, 3, 'Large', 30, false)],
} as Product;

let root: Root | null = null;

function render(props: Partial<React.ComponentProps<typeof VariantPickerModal>> = {}) {
    const onClose = vi.fn();
    const onAdd = vi.fn();
    const host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root!.render(<VariantPickerModal product={product} open onClose={onClose} onAdd={onAdd} {...props} />));
    return { onClose, onAdd, host };
}

const buttonByText = (text: string) => Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim().startsWith(text)) as HTMLButtonElement;

afterEach(() => {
    act(() => root?.unmount());
    root = null;
    document.body.innerHTML = '';
});

describe('VariantPickerModal', () => {
    it('renders nothing while closed', () => {
        render({ open: false });
        expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    });

    it('shows the options in <body>, starts on the default variant and adds the chosen one', () => {
        const { onAdd } = render();

        expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
        expect(document.body.textContent).toContain('$20.00');

        act(() => buttonByText('Medium').click());
        expect(document.body.textContent).toContain('$25.00');

        act(() => buttonByText('Add to Cart').click());
        expect(onAdd).toHaveBeenCalledTimes(1);
        expect(onAdd.mock.calls[0][0]).toMatchObject({ variantId: 11, price: 25 });
    });

    it('does not let a sold-out variant be added', () => {
        const { onAdd } = render();

        act(() => buttonByText('Large').click());

        expect(document.body.textContent).toContain('Out of Stock');
        const add = buttonByText('Out of stock');
        expect(add.disabled).toBe(true);
        act(() => add.click());
        expect(onAdd).not.toHaveBeenCalled();
    });

    it('closes on Escape, on the close button and on the backdrop', () => {
        const { onClose } = render();
        const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement;

        act(() => {
            dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        });
        expect(onClose).toHaveBeenCalledTimes(1);

        act(() => (document.body.querySelector('[aria-label="Close"]') as HTMLButtonElement).click());
        expect(onClose).toHaveBeenCalledTimes(2);

        act(() => {
            (dialog.parentElement as HTMLElement).dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        });
        expect(onClose).toHaveBeenCalledTimes(3);
    });

    it('locks page scroll while open and restores it on close', () => {
        document.body.style.overflow = 'auto';
        render();
        expect(document.body.style.overflow).toBe('hidden');

        act(() => root!.unmount());
        root = null;
        expect(document.body.style.overflow).toBe('auto');
    });
});
