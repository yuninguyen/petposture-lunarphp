import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyToClipboard } from './clipboard';

const execCommand = vi.fn();

beforeEach(() => {
  execCommand.mockReset();
  Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true, writable: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
});

function setClipboard(writeText: ((text: string) => Promise<void>) | undefined) {
  Object.defineProperty(navigator, 'clipboard', { value: writeText ? { writeText } : undefined, configurable: true });
}

describe('copyToClipboard', () => {
  it('copies with the clipboard API and says it worked', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard(writeText);

    await expect(copyToClipboard('Does your Frenchie eat too fast?')).resolves.toBe(true);

    expect(writeText).toHaveBeenCalledWith('Does your Frenchie eat too fast?');
    expect(execCommand).not.toHaveBeenCalled();
  });

  it('copies through a hidden text box when the clipboard API is refused, and leaves nothing behind', async () => {
    setClipboard(vi.fn().mockRejectedValue(new Error('denied')));
    let copied = '';
    execCommand.mockImplementation(() => {
      copied = (document.activeElement as HTMLTextAreaElement).value;
      return true;
    });

    await expect(copyToClipboard('A tilted bowl can help.')).resolves.toBe(true);

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(copied).toBe('A tilted bowl can help.');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('uses the hidden text box when there is no clipboard API at all', async () => {
    setClipboard(undefined);
    execCommand.mockReturnValue(true);

    await expect(copyToClipboard('Text')).resolves.toBe(true);
  });

  it('says it did not work when both ways fail', async () => {
    setClipboard(vi.fn().mockRejectedValue(new Error('denied')));
    execCommand.mockReturnValue(false);

    await expect(copyToClipboard('Text')).resolves.toBe(false);
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('says it did not work when the fallback throws', async () => {
    setClipboard(undefined);
    execCommand.mockImplementation(() => {
      throw new Error('not allowed');
    });

    await expect(copyToClipboard('Text')).resolves.toBe(false);
  });
});
