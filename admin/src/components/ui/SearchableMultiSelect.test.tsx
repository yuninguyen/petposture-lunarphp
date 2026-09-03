import { act, createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { SearchableMultiSelect } from './SearchableMultiSelect';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderPicker() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);

  function Picker() {
    const [value, setValue] = useState<number[]>([]);
    return createElement(SearchableMultiSelect, {
      options: [{ id: 1, label: 'Harness' }],
      value,
      onChange: setValue,
      placeholder: 'Find products',
      noResultsText: 'No matching variants',
      selectedCountText: (count) => `${count} variants selected`,
      clearAllText: 'Remove all',
    });
  }

  act(() => root.render(createElement(Picker)));
  return { host, root };
}

describe('SearchableMultiSelect', () => {
  it('uses localized visible text while preserving selection and clearing', () => {
    const { host, root } = renderPicker();
    const checkbox = host.querySelector<HTMLInputElement>('input[type="checkbox"]')!;

    expect(host.textContent).toContain('0 variants selected');
    act(() => checkbox.click());
    expect(host.textContent).toContain('1 variants selected');
    expect(host.textContent).toContain('Remove all');

    const clearButton = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'Remove all');
    expect(clearButton).toBeTruthy();
    act(() => clearButton!.click());
    expect(host.textContent).toContain('0 variants selected');
    expect(host.textContent).not.toContain('Remove all');

    act(() => root.unmount());
    host.remove();
  });

  it('uses the localized empty-result text', () => {
    const { host, root } = renderPicker();
    const input = host.querySelector<HTMLInputElement>('input[placeholder="Find products"]')!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;

    act(() => { setter.call(input, 'missing'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(host.textContent).toContain('No matching variants');

    act(() => root.unmount());
    host.remove();
  });
});
