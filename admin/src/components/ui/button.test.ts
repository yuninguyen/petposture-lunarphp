import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { Button } from './button';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderButton(variant?: 'primary' | 'secondary' | 'danger') {
  const host = document.createElement('div');
  const root = createRoot(host);
  act(() => root.render(createElement(Button, { variant }, 'Action')));
  const button = host.querySelector('button')!;
  return { button, cleanup: () => act(() => root.unmount()) };
}

describe('Button variants', () => {
  it('uses the solid CTA treatment for primary and the default variant', () => {
    for (const variant of [undefined, 'primary'] as const) {
      const { button, cleanup } = renderButton(variant);
      expect(button.className).toContain('bg-secondary');
      expect(button.className).toContain('text-white');
      cleanup();
    }
  });

  it('uses the outline treatment for secondary actions', () => {
    const { button, cleanup } = renderButton('secondary');
    expect(button.className).toContain('bg-white');
    expect(button.className).toContain('border-gray-300');
    cleanup();
  });

  it('keeps the red destructive treatment for danger actions', () => {
    const { button, cleanup } = renderButton('danger');
    expect(button.className).toContain('bg-red-600');
    cleanup();
  });
});
