import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { ProductDescriptionEditor } from './ProductDescriptionEditor';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/features/posts/TipTapToolbar', () => ({ TipTapToolbar: () => null }));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ProductDescriptionEditor', () => {
  it('renders description received after the editor has mounted', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const onChange = vi.fn();

    await act(async () => {
      root.render(createElement(ProductDescriptionEditor, { value: '', onChange }));
    });
    await act(async () => {
      root.render(createElement(ProductDescriptionEditor, {
        value: '<p>Saved product description</p><ul><li>Feature one</li></ul>',
        onChange,
      }));
    });

    expect(host.textContent).toContain('Saved product description');
    expect(host.textContent).toContain('Feature one');
    expect(onChange).not.toHaveBeenCalledWith('');

    act(() => root.unmount());
    host.remove();
  });
});
