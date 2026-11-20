// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { PickAccordionSection } from './PickAccordionSection';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const sections = (
    <>
        <PickAccordionSection title="Product details"><p>The description.</p></PickAccordionSection>
        <PickAccordionSection title="Quick Specs"><p>The specs.</p></PickAccordionSection>
    </>
);

async function mount() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => root.render(sections));

    return container;
}

const button = (container: HTMLElement, title: string) =>
    [...container.querySelectorAll('button')].find((candidate) => candidate.textContent?.includes(title))!;
const contentId = (container: HTMLElement, text: string) =>
    [...container.querySelectorAll('div[id]')].find((element) => element.textContent === text)!.id;
const content = (container: HTMLElement, text: string) => container.querySelector(`[id="${contentId(container, text)}"]`) as HTMLElement;
const click = async (element: Element) => act(async () => { element.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const hidden = (element: HTMLElement) => /(^|\s)hidden(\s|$)/.test(element.className);

describe('PickAccordionSection', () => {
    afterEach(() => { document.body.innerHTML = ''; });

    it('starts closed: the button says so, shows a plus and the content is hidden', async () => {
        const container = await mount();
        const trigger = button(container, 'Product details');

        expect(trigger.getAttribute('aria-expanded')).toBe('false');
        expect(trigger.textContent).toContain('+');
        expect(trigger.textContent).not.toContain('−');
        expect(hidden(content(container, 'The description.'))).toBe(true);
    });

    it('opens and closes when the title is pressed, and the sign follows', async () => {
        const container = await mount();
        const trigger = button(container, 'Product details');

        await click(trigger);
        expect(trigger.getAttribute('aria-expanded')).toBe('true');
        expect(trigger.textContent).toContain('−');
        expect(hidden(content(container, 'The description.'))).toBe(false);

        await click(trigger);
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
        expect(trigger.textContent).toContain('+');
        expect(hidden(content(container, 'The description.'))).toBe(true);
    });

    it('is independent of the other section: opening one leaves the other as it was', async () => {
        const container = await mount();

        await click(button(container, 'Quick Specs'));

        expect(button(container, 'Quick Specs').getAttribute('aria-expanded')).toBe('true');
        expect(button(container, 'Product details').getAttribute('aria-expanded')).toBe('false');

        await click(button(container, 'Product details'));

        expect(button(container, 'Quick Specs').getAttribute('aria-expanded')).toBe('true');
        expect(button(container, 'Product details').getAttribute('aria-expanded')).toBe('true');
    });

    it('points the button at its content', async () => {
        const container = await mount();

        expect(button(container, 'Quick Specs').getAttribute('aria-controls')).toBe(contentId(container, 'The specs.'));
    });

    it('from lg up shows the plain title and the content always, with no button', () => {
        const html = renderToStaticMarkup(sections);

        // the plain title is only drawn from lg up, the button only below it, and the content is forced visible from lg up
        expect(html).toMatch(/<h3 class="[^"]*hidden lg:block[^"]*">Product details<\/h3>/);
        expect(html).toMatch(/<h3 class="[^"]*lg:hidden[^"]*"><button[^>]*aria-expanded="false"/);
        expect(html).toMatch(/<div id="[^"]*" class="[^"]*hidden lg:block[^"]*"><p>The description\.<\/p><\/div>/);
    });
});
