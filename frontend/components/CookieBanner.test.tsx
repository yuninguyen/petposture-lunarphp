// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CookieBanner } from './CookieBanner';
import { getConsent } from '@/lib/cookieConsent';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

// Newer Node versions ship their own incomplete global localStorage that hides jsdom's, so the test brings its own.
function memoryStorage(): Storage {
    const data = new Map<string, string>();

    return {
        get length() { return data.size; },
        clear: () => data.clear(),
        getItem: (key) => data.get(key) ?? null,
        key: (index) => [...data.keys()][index] ?? null,
        removeItem: (key) => { data.delete(key); },
        setItem: (key, value) => { data.set(key, String(value)); },
    };
}

beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});
afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

const mount = () => act(() => root.render(React.createElement(CookieBanner)));

describe('CookieBanner', () => {
    it('is one short sentence with a Cookie Policy link', () => {
        mount();

        const sentence = host.querySelector('p')!;
        expect(sentence.textContent).toBe('We use cookies to understand how you use our site. See our Cookie Policy.');
        expect(sentence.querySelector('a')!.getAttribute('href')).toBe('/cookie-policy');
    });

    it('keeps both actions, side by side at equal width on small screens', () => {
        mount();

        const labels = [...host.querySelectorAll('button')].map((button) => button.textContent);
        expect(labels).toEqual(['Customize', 'Accept All']);
        const row = host.querySelector('button')!.parentElement!;
        expect(row.className).toContain('grid-cols-2');
    });

    it('uses compact vertical padding', () => {
        mount();

        expect(host.querySelector('.fixed')!.className).toContain('py-3');
    });

    it('Accept All records the consent and closes the banner', () => {
        mount();
        const accept = [...host.querySelectorAll('button')].find((button) => button.textContent === 'Accept All')!;
        act(() => accept.click());

        expect(getConsent()).toMatchObject({ analytics: true, method: 'accept_all' });
    });
});
