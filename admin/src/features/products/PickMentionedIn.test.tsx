import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import { PickMentionedIn } from './PickMentionedIn';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
const mount = (posts: Array<{ id: number; title: string; published_at: string | null }>) =>
  act(() => root.render(createElement(MemoryRouter, null, createElement(PickMentionedIn, { posts }))));

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('PickMentionedIn', () => {
  it('lists each post with its date and a link to edit it, and says the list is changed on the post', () => {
    mount([{ id: 8, title: 'Tilted Bowl vs Slow Feeder for French Bulldogs', published_at: '2026-11-14T12:00:00.000Z' }]);

    const link = host.querySelector('a')!;
    expect(link.getAttribute('href')).toBe('/posts/8');
    expect(link.textContent).toBe('Tilted Bowl vs Slow Feeder for French Bulldogs');
    expect(host.textContent).toContain('products.mentioned_in.title');
    expect(host.textContent).toContain('products.mentioned_in.hint');
    expect(host.querySelector('input, select, textarea')).toBeNull();
  });

  it('draws nothing when no post mentions the pick', () => {
    mount([]);

    expect(host.innerHTML).toBe('');
  });
});
