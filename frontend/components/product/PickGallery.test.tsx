// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PickGallery } from './PickGallery';

const images = (count: number) => Array.from({ length: count }, (_, i) => ({ id: i + 1, src: `/img/${i + 1}.jpg`, alt: `Photo ${i + 1}` }));

let host: HTMLDivElement;
let root: Root;
const scrollIntoView = vi.fn();

function mount(count: number) {
    act(() => {
        root.render(<PickGallery images={images(count)} name="Test pick" />);
    });
}
const button = (label: string) => host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
const click = (el: HTMLElement) => act(() => { el.click(); });
const counter = () => host.querySelector('[aria-live="polite"]')?.textContent;
const mainAlt = () => host.querySelector('.aspect-\\[4\\/3\\] img')?.getAttribute('alt');

beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Element.prototype.scrollIntoView = scrollIntoView;
    scrollIntoView.mockClear();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => root.unmount());
    host.remove();
});

describe('PickGallery', () => {
    it('stacks the main image above the thumbnail strip with an arrow at each end', () => {
        mount(8);

        const column = host.firstElementChild!;
        expect(column.className).toContain('flex-col');
        expect(column.className).not.toContain('md:flex-row');
        expect(column.children).toHaveLength(2);
        expect(column.children[0].className).toContain('aspect-[4/3]');

        const strip = column.children[1];
        expect(strip.firstElementChild).toBe(button('Previous image'));
        expect(strip.lastElementChild).toBe(button('Next image'));
        expect(strip.querySelectorAll('button[aria-label^="Show image"]')).toHaveLength(8);
    });

    it('sizes the arrows 36px/40px and the thumbnails 64px/72px', () => {
        mount(3);

        expect(button('Next image').className).toContain('h-9 w-9');
        expect(button('Next image').className).toContain('md:h-10 md:w-10');
        for (const label of ['Previous image', 'Next image']) {
            expect(button(label).className).toContain('rounded-[3px]');
            expect(button(label).className).not.toContain('rounded-full');
        }
        expect(button('Show image 1').className).toContain('h-16 w-16');
        expect(button('Show image 1').className).toContain('md:h-[72px] md:w-[72px]');
    });

    it('shows the count at the bottom right of the main image and the orange border on the chosen thumbnail', () => {
        mount(8);

        expect(counter()).toBe('1/8');
        expect(host.querySelector('[aria-live="polite"]')!.className).toContain('bottom-3 right-3');
        expect(button('Show image 1').className).toContain('border-secondary');
        expect(button('Show image 2').className).not.toContain('border-secondary');
    });

    it('steps to the next and previous image with the arrows', () => {
        mount(8);

        click(button('Next image'));
        expect(counter()).toBe('2/8');
        expect(mainAlt()).toBe('Photo 2');
        expect(button('Show image 2').className).toContain('border-secondary');
        expect(button('Show image 1').className).not.toContain('border-secondary');

        click(button('Previous image'));
        expect(counter()).toBe('1/8');
        expect(mainAlt()).toBe('Photo 1');
    });

    it('wraps around at both ends', () => {
        mount(3);

        click(button('Previous image'));
        expect(counter()).toBe('3/3');
        click(button('Next image'));
        expect(counter()).toBe('1/3');
    });

    it('jumps to a thumbnail when it is clicked', () => {
        mount(8);

        click(button('Show image 5'));
        expect(counter()).toBe('5/8');
        expect(mainAlt()).toBe('Photo 5');
        expect(button('Show image 5').getAttribute('aria-current')).toBe('true');
    });

    it('scrolls the chosen thumbnail into view after a change, but not on first paint', () => {
        mount(8);
        expect(scrollIntoView).not.toHaveBeenCalled();

        click(button('Next image'));
        expect(scrollIntoView).toHaveBeenCalledTimes(1);
        expect(scrollIntoView).toHaveBeenCalledWith({ inline: 'nearest', block: 'nearest' });
    });

    it('lets the strip scroll sideways', () => {
        mount(8);

        expect(button('Show image 1').parentElement!.className).toContain('overflow-x-auto');
    });

    it('hides the strip, arrows and count when there is only one image', () => {
        mount(1);

        expect(host.querySelectorAll('button')).toHaveLength(0);
        expect(counter()).toBeUndefined();
        expect(host.querySelector('img')).not.toBeNull();
    });

    it('renders nothing without images', () => {
        mount(0);

        expect(host.innerHTML).toBe('');
    });
});
