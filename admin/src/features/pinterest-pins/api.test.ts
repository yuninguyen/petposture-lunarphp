import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchJson = vi.fn();
const fetchApi = vi.fn();

vi.mock('@/lib/api', () => ({
  fetchJson: (...args: unknown[]) => fetchJson(...args),
  fetchApi: (...args: unknown[]) => fetchApi(...args),
}));

import {
  completePinterestCallback,
  createPin,
  deletePin,
  deletePinOnPinterest,
  deletePinterestBoard,
  disconnectPinterest,
  downloadPinImage,
  fetchPinOptions,
  fetchPinterestBoards,
  fetchPinterestConnection,
  fetchPins,
  markPinPosted,
  pinFilename,
  publishPinNow,
  retryPin,
  startPinterestConnect,
  updatePin,
  updatePinterestSettings,
  type PinterestPin,
} from './api';

const pin = { id: 7, title: 'Does your Frenchie eat too fast?', image: 'media/pin.png' } as PinterestPin;

beforeEach(() => {
  fetchJson.mockReset();
  fetchApi.mockReset();
});

describe('pin list request', () => {
  it('asks for the first page with no filter', async () => {
    fetchJson.mockResolvedValue({ data: [], meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 } });

    await fetchPins({ status: '', postId: '', page: 1 });

    expect(fetchJson).toHaveBeenCalledWith('/admin/pinterest-pins?page=1');
  });

  it('sends the status and post filters only when they are chosen', async () => {
    fetchJson.mockResolvedValue({ data: [], meta: { current_page: 2, last_page: 2, per_page: 20, total: 21 } });

    await fetchPins({ status: 'posted', postId: 5, page: 2 });

    expect(fetchJson).toHaveBeenCalledWith('/admin/pinterest-pins?status=posted&post_id=5&page=2');
  });

  it('returns the pins and the paging', async () => {
    const meta = { current_page: 1, last_page: 3, per_page: 20, total: 41 };
    fetchJson.mockResolvedValue({ data: [pin], meta });

    await expect(fetchPins({ status: '', postId: '', page: 1 })).resolves.toEqual({ data: [pin], meta });
  });
});

describe('pin options', () => {
  it('unwraps the boards and posts of the form', async () => {
    const options = { boards: ['Dog Feeding'], posts: [{ id: 1, title: 'A post', slug: 'a-post', url: 'https://petposture.com/blog/a-post' }] };
    fetchJson.mockResolvedValue({ data: options });

    await expect(fetchPinOptions()).resolves.toEqual(options);
    expect(fetchJson).toHaveBeenCalledWith('/admin/pinterest-pins/options');
  });
});

describe('pin writes', () => {
  const payload = {
    media_id: 12,
    post_id: 5,
    title: 'T',
    description: 'D',
    destination_url: 'https://petposture.com/blog/x',
    board: null,
    pinterest_board_id: null,
    status: 'ready' as const,
    scheduled_date: null,
  };

  it('creates a pin and returns it unwrapped', async () => {
    fetchJson.mockResolvedValue({ data: pin });

    await expect(createPin(payload)).resolves.toEqual(pin);
    expect(fetchJson).toHaveBeenCalledWith('/admin/pinterest-pins', { method: 'POST', body: payload });
  });

  it('updates a pin by id', async () => {
    fetchJson.mockResolvedValue({ data: pin });

    await updatePin(7, payload);

    expect(fetchJson).toHaveBeenCalledWith('/admin/pinterest-pins/7', { method: 'PUT', body: payload });
  });

  it('deletes a pin by id', async () => {
    fetchJson.mockResolvedValue(null);

    await deletePin(7);

    expect(fetchJson).toHaveBeenCalledWith('/admin/pinterest-pins/7', { method: 'DELETE' });
  });

  it('marks a pin posted by sending only the status, so nothing else is changed', async () => {
    fetchJson.mockResolvedValue({ data: { ...pin, status: 'posted' } });

    const result = await markPinPosted(7);

    expect(fetchJson).toHaveBeenCalledWith('/admin/pinterest-pins/7', { method: 'PUT', body: { status: 'posted' } });
    expect(result.status).toBe('posted');
  });

  it('retries a pin by sending only the status ready', async () => {
    fetchJson.mockResolvedValue({ data: { ...pin, status: 'ready' } });

    await retryPin(7);

    expect(fetchJson).toHaveBeenCalledWith('/admin/pinterest-pins/7', { method: 'PUT', body: { status: 'ready' } });
  });
});

describe('posting now', () => {
  it('asks the server to post that pin straight away', async () => {
    fetchJson.mockResolvedValue({ data: { id: 7, status: 'posted' } });

    await publishPinNow(7);

    expect(fetchJson).toHaveBeenCalledWith('/admin/pinterest/pins/7/publish', { method: 'POST' });
  });
});

describe('deleting on Pinterest', () => {
  it('deletes a posted pin on Pinterest by its admin id', async () => {
    fetchJson.mockResolvedValue(null);

    await deletePinOnPinterest(7);

    expect(fetchJson).toHaveBeenCalledWith('/admin/pinterest/pins/7', { method: 'DELETE' });
  });

  it('deletes a board on Pinterest by its Pinterest id', async () => {
    fetchJson.mockResolvedValue(null);

    await deletePinterestBoard('549755885175');

    expect(fetchJson).toHaveBeenCalledWith('/admin/pinterest/boards/549755885175', { method: 'DELETE' });
  });
});

describe('Pinterest connection requests', () => {
  it('reads the connection, unwrapped', async () => {
    const connection = { configured: true, connected: true, status: 'connected', username: 'petposture' };
    fetchJson.mockResolvedValue({ data: connection });

    await expect(fetchPinterestConnection()).resolves.toEqual(connection);
    expect(fetchJson).toHaveBeenCalledWith('/admin/pinterest/connection');
  });

  it('asks the server for the Pinterest page to visit and returns its address', async () => {
    fetchJson.mockResolvedValue({ data: { url: 'https://www.pinterest.com/oauth/?state=abc' } });

    await expect(startPinterestConnect()).resolves.toBe('https://www.pinterest.com/oauth/?state=abc');
    expect(fetchJson).toHaveBeenCalledWith('/admin/pinterest/connect', { method: 'POST' });
  });

  it('hands the code and the state back to the server', async () => {
    fetchJson.mockResolvedValue({ data: { username: 'petposture' } });

    await expect(completePinterestCallback('the-code', 'the-state')).resolves.toEqual({ username: 'petposture' });
    expect(fetchJson).toHaveBeenCalledWith('/admin/pinterest/callback', { method: 'POST', body: { code: 'the-code', state: 'the-state' } });
  });

  it('disconnects, lists boards and saves the posting switches', async () => {
    fetchJson.mockResolvedValue(null);
    await disconnectPinterest();
    expect(fetchJson).toHaveBeenCalledWith('/admin/pinterest/connection', { method: 'DELETE' });

    fetchJson.mockResolvedValue({ data: [{ id: '1', name: 'Feeding' }] });
    await expect(fetchPinterestBoards()).resolves.toEqual([{ id: '1', name: 'Feeding' }]);
    expect(fetchJson).toHaveBeenCalledWith('/admin/pinterest/boards');

    fetchJson.mockResolvedValue({ data: { auto_publish: true } });
    await updatePinterestSettings({ auto_publish: true });
    expect(fetchJson).toHaveBeenCalledWith('/admin/pinterest/settings', { method: 'PUT', body: { auto_publish: true } });
  });
});

describe('pin image download', () => {
  const click = vi.fn();
  let created: HTMLAnchorElement | null = null;

  beforeEach(() => {
    click.mockReset();
    created = null;
    URL.createObjectURL = vi.fn(() => 'blob:pin-image');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      created = this;
      click();
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('names the file as the server says', async () => {
    fetchApi.mockResolvedValue(new Response(new Blob(['png']), {
      status: 200,
      headers: { 'Content-Disposition': 'attachment; filename=does-your-frenchie-eat-too-fast.png' },
    }));

    await downloadPinImage(pin);

    expect(fetchApi).toHaveBeenCalledWith('/admin/pinterest-pins/7/download');
    expect(click).toHaveBeenCalledTimes(1);
    expect(created?.download).toBe('does-your-frenchie-eat-too-fast.png');
    expect(created?.href).toBe('blob:pin-image');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:pin-image');
  });

  it('falls back to a name made from the title and the image extension', async () => {
    fetchApi.mockResolvedValue(new Response(new Blob(['png']), { status: 200 }));

    await downloadPinImage(pin);

    expect(created?.download).toBe('does-your-frenchie-eat-too-fast.png');
  });

  it('names a WebP image as a jpg when the server hands over a JPEG and the browser hides the file name', async () => {
    fetchApi.mockResolvedValue(new Response(new Blob(['jpeg']), { status: 200, headers: { 'Content-Type': 'image/jpeg' } }));

    await downloadPinImage({ ...pin, image: 'media/abc.webp' });

    expect(created?.download).toBe('does-your-frenchie-eat-too-fast.jpg');
  });

  it('says why when the file cannot be downloaded', async () => {
    fetchApi.mockResolvedValue(new Response(JSON.stringify({ message: 'The image file of this pin is missing.' }), { status: 404 }));

    await expect(downloadPinImage(pin)).rejects.toThrow('The image file of this pin is missing.');
    expect(click).not.toHaveBeenCalled();
  });
});

describe('pinFilename with the type of the file received', () => {
  it('names a converted image by what it is now, not by the stored WebP', () => {
    expect(pinFilename({ title: 'Does your Frenchie eat too fast?', image: 'media/abc.webp' }, 'image/jpeg')).toBe('does-your-frenchie-eat-too-fast.jpg');
    expect(pinFilename({ title: 'A pin', image: 'media/abc.webp' }, 'image/png')).toBe('a-pin.png');
  });

  it('keeps the stored extension when the type is unknown or empty', () => {
    expect(pinFilename({ title: 'A pin', image: 'media/abc.png' }, 'application/octet-stream')).toBe('a-pin.png');
    expect(pinFilename({ title: 'A pin', image: 'media/abc.png' }, '')).toBe('a-pin.png');
  });
});

describe('pinFilename', () => {
  it('makes a safe file name from the title and keeps the extension of the image', () => {
    expect(pinFilename({ title: 'Does your Frenchie eat too fast?', image: 'media/abc.webp' })).toBe('does-your-frenchie-eat-too-fast.webp');
    expect(pinFilename({ title: '🐶🐶', image: 'media/abc.jpg' })).toBe('pinterest-pin.jpg');
    expect(pinFilename({ title: 'No extension', image: 'media/abc' })).toBe('no-extension');
  });
});
