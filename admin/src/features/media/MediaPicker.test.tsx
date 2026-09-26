import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/components/ui/media-library-modal', () => ({
  MediaLibraryModal: ({ open }: { open: boolean }) => <div data-testid="media-modal" data-open={String(open)} />,
}));

import { MediaPicker } from './MediaPicker';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('MediaPicker', () => {
  it('disables browse and remove actions without changing existing enabled behavior', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const onChange = vi.fn();

    await act(async () => {
      root.render(createElement(MediaPicker, {
        value: { id: '1', url: 'https://cdn.example/image.png' },
        onChange,
        context: 'general',
        disabled: true,
      }));
    });

    const disabledButtons = host.querySelectorAll<HTMLButtonElement>('button');
    expect(Array.from(disabledButtons).every((button) => button.disabled)).toBe(true);
    await act(async () => disabledButtons[1].click());
    expect(onChange).not.toHaveBeenCalled();

    await act(async () => {
      root.render(createElement(MediaPicker, {
        value: null,
        onChange,
        context: 'general',
      }));
    });
    const browse = host.querySelector<HTMLButtonElement>('button')!;
    expect(browse).not.toBeDisabled();
    await act(async () => browse.click());
    expect(host.querySelector('[data-testid="media-modal"]')).toHaveAttribute('data-open', 'true');

    act(() => root.unmount());
    host.remove();
  });

  it('uses a square contained preview for favicons', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(createElement(MediaPicker, {
        value: { id: '1', url: 'https://cdn.example/favicon.png' },
        onChange: vi.fn(),
        context: 'general',
        preview: 'favicon',
      }));
    });

    expect(host.querySelector('img')).toHaveClass('aspect-square', 'object-contain');

    await act(async () => {
      root.render(createElement(MediaPicker, {
        value: null,
        onChange: vi.fn(),
        context: 'general',
        preview: 'favicon',
      }));
    });
    expect(host.querySelector('button')).toHaveClass('aspect-square');

    act(() => root.unmount());
    host.remove();
  });

  it('uses a fixed-height contained preview for logos', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(createElement(MediaPicker, {
        value: { id: '1', url: 'https://cdn.example/logo.png' },
        onChange: vi.fn(),
        context: 'general',
        preview: 'logo',
      }));
    });

    expect(host.querySelector('img')).toHaveClass('h-64', 'object-contain');

    act(() => root.unmount());
    host.remove();
  });
});
