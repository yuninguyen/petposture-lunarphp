import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@/i18n';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, fetchJson: vi.fn(), fetchApi: vi.fn() };
});

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('./clipboard', () => ({ copyToClipboard: vi.fn() }));

// The library is not what is being tested here.
vi.mock('@/components/ui/media-library-modal', () => ({ MediaLibraryModal: () => null }));

import toast from 'react-hot-toast';
import { fetchApi, fetchJson, type FetchApiOptions } from '@/lib/api';
import { copyToClipboard } from './clipboard';
import { PinterestPinsPage } from './PinterestPinsPage';
import type { PinterestPin } from './api';

const readyPin: PinterestPin = {
  id: 7,
  post_id: 5,
  post: { id: 5, title: 'Tilted Bowl vs Slow Feeder', slug: 'tilted-bowl-vs-slow-feeder' },
  media_id: '12',
  image: 'media/pin-1.png',
  image_url: 'https://api.test/storage/media/pin-1.png',
  image_width: 1000,
  image_height: 1500,
  title: 'Does your Frenchie eat too fast?',
  description: 'A tilted bowl can help a flat-faced dog eat.',
  destination_url: 'https://petposture.com/blog/tilted-bowl-vs-slow-feeder',
  board: 'French Bulldog Tips',
  pinterest_board_id: null,
  status: 'ready',
  scheduled_date: '2026-11-25',
  posted_at: null,
  posted_via: null,
  pinterest_pin_id: null,
  publish_attempts: 0,
  last_error: null,
  created_at: '2026-11-17T08:00:00.000000Z',
  updated_at: '2026-11-17T08:00:00.000000Z',
};

const postedPin: PinterestPin = {
  ...readyPin,
  id: 8,
  post_id: null,
  post: null,
  media_id: '13',
  image: 'media/pin-2.webp',
  image_url: 'https://api.test/storage/media/pin-2.webp',
  title: 'Raised bowls for flat faces',
  description: 'Why a raised bowl helps.',
  board: null,
  status: 'posted',
  scheduled_date: null,
  posted_at: '2026-11-21T09:30:00.000000Z',
};

const options = {
  boards: ['French Bulldog Tips'],
  posts: [{ id: 5, title: 'Tilted Bowl vs Slow Feeder', slug: 'tilted-bowl-vs-slow-feeder', url: 'https://petposture.com/blog/tilted-bowl-vs-slow-feeder' }],
};

const meta = (overrides = {}) => ({ current_page: 1, last_page: 1, per_page: 20, total: 2, ...overrides });

const notConnected = {
  configured: true,
  connected: false,
  status: 'not_connected',
  username: null,
  last_error: null,
  refresh_expires_at: null,
  settings: { auto_publish: false, max_per_day: 3, min_gap_minutes: 180, window_start: '08:00', window_end: '21:00', timezone: 'America/New_York' },
  recent_errors: [],
};

const mockedFetch = vi.mocked(fetchJson);
const mockedFetchApi = vi.mocked(fetchApi);
const mockedCopy = vi.mocked(copyToClipboard);

function listCalls() {
  return mockedFetch.mock.calls.map(([url]) => String(url)).filter((url) => url.startsWith('/admin/pinterest-pins?'));
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PinterestPinsPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockedFetch.mockReset();
  mockedFetchApi.mockReset();
  mockedCopy.mockReset();
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
  mockedCopy.mockResolvedValue(true);
  mockedFetch.mockImplementation(async (url: string, init?: FetchApiOptions) => {
    if (url === '/admin/pinterest-pins/options') return { data: options };
    if (url === '/admin/pinterest/connection') return { data: notConnected };
    if (url.startsWith('/admin/pinterest-pins?')) return { data: [readyPin, postedPin], meta: meta() };
    if (init?.method === 'PUT') return { data: { ...readyPin, status: 'posted', posted_at: '2026-11-22T10:00:00.000000Z' } };
    return null;
  });
});

const rowOf = async (title: string) => (await screen.findByText(title)).closest('tr') as HTMLElement;

describe('PinterestPinsPage list', () => {
  it('shows each pin with its image, title, post, board, status and schedule', async () => {
    renderPage();

    const ready = await rowOf('Does your Frenchie eat too fast?');
    expect(within(ready).getByAltText('Does your Frenchie eat too fast?').getAttribute('src')).toBe(readyPin.image_url);
    expect(within(ready).getByText('Tilted Bowl vs Slow Feeder')).toBeTruthy();
    expect(within(ready).getByText('French Bulldog Tips')).toBeTruthy();
    expect(within(ready).getByText('Ready')).toBeTruthy();
    expect(within(ready).getByText('2026-11-25')).toBeTruthy();

    const posted = await rowOf('Raised bowls for flat faces');
    expect(within(posted).getByText('No post')).toBeTruthy();
    expect(within(posted).getByText('Posted')).toBeTruthy();
  });

  it('says when the pin was posted', async () => {
    renderPage();

    const posted = await rowOf('Raised bowls for flat faces');
    const when = new Date(postedPin.posted_at as string).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    expect(within(posted).getByText(`Posted ${when}`)).toBeTruthy();
  });

  it('shows the empty state when there is no pin', async () => {
    mockedFetch.mockImplementation(async (url: string) => {
      if (url === '/admin/pinterest/connection') return { data: notConnected };
      return url === '/admin/pinterest-pins/options' ? { data: options } : { data: [], meta: meta({ total: 0 }) };
    });
    renderPage();

    expect(await screen.findByText('No pins yet')).toBeTruthy();
  });

  it('says so when the filters match nothing', async () => {
    mockedFetch.mockImplementation(async (url: string) => {
      if (url === '/admin/pinterest-pins/options') return { data: options };
      if (url === '/admin/pinterest/connection') return { data: notConnected };
      if (url.includes('status=posted')) return { data: [], meta: meta({ total: 0 }) };
      return { data: [readyPin], meta: meta({ total: 1 }) };
    });
    renderPage();
    await screen.findByText('Does your Frenchie eat too fast?');

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'posted' } });

    expect(await screen.findByText('No pins match these filters.')).toBeTruthy();
  });
});

describe('PinterestPinsPage filters and paging', () => {
  it('asks for the first page with no filter', async () => {
    renderPage();
    await screen.findByText('Does your Frenchie eat too fast?');

    expect(listCalls()).toEqual(['/admin/pinterest-pins?page=1']);
  });

  it('filters by status', async () => {
    renderPage();
    await screen.findByText('Does your Frenchie eat too fast?');

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'posted' } });

    await waitFor(() => expect(listCalls()).toContain('/admin/pinterest-pins?status=posted&page=1'));
  });

  it('filters by blog post', async () => {
    renderPage();
    await screen.findByText('Does your Frenchie eat too fast?');
    await screen.findByRole('option', { name: 'Tilted Bowl vs Slow Feeder' });

    fireEvent.change(screen.getByLabelText('Post'), { target: { value: '5' } });

    await waitFor(() => expect(listCalls()).toContain('/admin/pinterest-pins?post_id=5&page=1'));
  });

  it('goes back to the first page when a filter changes', async () => {
    mockedFetch.mockImplementation(async (url: string) => {
      if (url === '/admin/pinterest-pins/options') return { data: options };
      if (url === '/admin/pinterest/connection') return { data: notConnected };
      return { data: [readyPin], meta: meta({ current_page: url.includes('page=2') ? 2 : 1, last_page: 2, total: 21 }) };
    });
    renderPage();
    await screen.findByText('Does your Frenchie eat too fast?');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(listCalls()).toContain('/admin/pinterest-pins?page=2'));

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'ready' } });

    await waitFor(() => expect(listCalls()).toContain('/admin/pinterest-pins?status=ready&page=1'));
  });

  it('pages through the pins', async () => {
    mockedFetch.mockImplementation(async (url: string) => {
      if (url === '/admin/pinterest-pins/options') return { data: options };
      if (url === '/admin/pinterest/connection') return { data: notConnected };
      return { data: [readyPin], meta: meta({ current_page: url.includes('page=2') ? 2 : 1, last_page: 2, total: 21 }) };
    });
    renderPage();
    await screen.findByText('Page 1 of 2');
    expect((screen.getByRole('button', { name: 'Previous' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByText('Page 2 of 2')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('PinterestPinsPage copy buttons', () => {
  it('copies the title of that pin and says so', async () => {
    renderPage();

    fireEvent.click(within(await rowOf('Does your Frenchie eat too fast?')).getByRole('button', { name: 'Copy title' }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Title copied'));
    expect(mockedCopy).toHaveBeenCalledWith('Does your Frenchie eat too fast?');
  });

  it('copies the description of that pin and says so', async () => {
    renderPage();

    fireEvent.click(within(await rowOf('Raised bowls for flat faces')).getByRole('button', { name: 'Copy description' }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Description copied'));
    expect(mockedCopy).toHaveBeenCalledWith('Why a raised bowl helps.');
  });

  it('tells the editor to copy by hand when the browser refuses', async () => {
    mockedCopy.mockResolvedValue(false);
    renderPage();

    fireEvent.click(within(await rowOf('Does your Frenchie eat too fast?')).getByRole('button', { name: 'Copy title' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not copy. Select the text and copy it by hand.'));
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe('PinterestPinsPage download', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:pin');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  it('downloads the image of that pin', async () => {
    mockedFetchApi.mockResolvedValue(new Response(new Blob(['png']), { status: 200 }));
    renderPage();

    fireEvent.click(within(await rowOf('Does your Frenchie eat too fast?')).getByRole('button', { name: 'Download image' }));

    await waitFor(() => expect(mockedFetchApi).toHaveBeenCalledWith('/admin/pinterest-pins/7/download'));
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalled());
  });

  it('says so when the image cannot be downloaded', async () => {
    mockedFetchApi.mockResolvedValue(new Response(JSON.stringify({ message: 'The image file of this pin is missing.' }), { status: 404 }));
    renderPage();

    fireEvent.click(within(await rowOf('Does your Frenchie eat too fast?')).getByRole('button', { name: 'Download image' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('The image file of this pin is missing.'));
  });
});

describe('PinterestPinsPage mark as posted', () => {
  it('offers it only for a pin that is not posted yet', async () => {
    renderPage();

    expect(within(await rowOf('Does your Frenchie eat too fast?')).getByRole('button', { name: 'Mark as posted' })).toBeTruthy();
    expect(within(await rowOf('Raised bowls for flat faces')).queryByRole('button', { name: 'Mark as posted' })).toBeNull();
  });

  it('sends only the status, says so and reloads the list', async () => {
    renderPage();
    await screen.findByText('Does your Frenchie eat too fast?');
    const before = listCalls().length;

    fireEvent.click(within(await rowOf('Does your Frenchie eat too fast?')).getByRole('button', { name: 'Mark as posted' }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Marked as posted'));
    expect(mockedFetch).toHaveBeenCalledWith('/admin/pinterest-pins/7', { method: 'PUT', body: { status: 'posted' } });
    await waitFor(() => expect(listCalls().length).toBeGreaterThan(before));
  });
});

describe('PinterestPinsPage create, edit and delete', () => {
  it('opens an empty form from "New pin"', async () => {
    renderPage();
    await screen.findByText('Does your Frenchie eat too fast?');

    fireEvent.click(screen.getByRole('button', { name: 'New pin' }));

    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('');
  });

  it('opens that pin in the form from "Edit pin"', async () => {
    renderPage();

    fireEvent.click(within(await rowOf('Does your Frenchie eat too fast?')).getByRole('button', { name: 'Edit pin' }));

    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Does your Frenchie eat too fast?');
  });

  it('asks before deleting, then deletes that pin only', async () => {
    renderPage();

    fireEvent.click(within(await rowOf('Does your Frenchie eat too fast?')).getByRole('button', { name: 'Delete pin' }));
    expect(await screen.findByText('Delete pin?')).toBeTruthy();
    expect(mockedFetch).not.toHaveBeenCalledWith('/admin/pinterest-pins/7', { method: 'DELETE' });

    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    await waitFor(() => expect(mockedFetch).toHaveBeenCalledWith('/admin/pinterest-pins/7', { method: 'DELETE' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Pin deleted'));
  });
});

describe('PinterestPinsPage automatic posting', () => {
  const failedPin: PinterestPin = { ...readyPin, id: 9, title: 'A pin that failed', status: 'failed', last_error: 'Invalid board', publish_attempts: 3 };
  const reviewPin: PinterestPin = { ...readyPin, id: 10, title: 'A pin to check', status: 'needs_review', last_error: 'Pinterest did not confirm.' };
  const apiPin: PinterestPin = { ...postedPin, id: 11, title: 'Posted by the job', posted_via: 'api' };

  function withPins(pins: PinterestPin[], connection: object = notConnected) {
    mockedFetch.mockImplementation(async (url: string, init?: FetchApiOptions) => {
      if (url === '/admin/pinterest-pins/options') return { data: options };
      if (url === '/admin/pinterest/connection') return { data: connection };
      if (url.startsWith('/admin/pinterest-pins?')) return { data: pins, meta: meta({ total: pins.length }) };
      if (init?.method === 'PUT') return { data: { ...readyPin, status: 'ready' } };
      return null;
    });
  }

  it('shows why a pin failed and that one needs checking, and where a posted pin came from', async () => {
    withPins([failedPin, reviewPin, apiPin]);
    renderPage();

    const failed = await rowOf('A pin that failed');
    expect(within(failed).getByText('Failed')).toBeTruthy();
    expect(within(failed).getByText('Invalid board')).toBeTruthy();

    const review = await rowOf('A pin to check');
    expect(within(review).getByText('Check on Pinterest')).toBeTruthy();
    expect(within(review).getByText(/Pinterest did not confirm\. Check if it was posted/)).toBeTruthy();

    const posted = await rowOf('Posted by the job');
    expect(within(posted).getByText(/by the API/)).toBeTruthy();
  });

  it('retries a failed pin by putting it back to ready', async () => {
    withPins([failedPin]);
    renderPage();

    fireEvent.click(within(await rowOf('A pin that failed')).getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(mockedFetch).toHaveBeenCalledWith('/admin/pinterest-pins/9', { method: 'PUT', body: { status: 'ready' } }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('The pin is ready to be posted again.'));
  });

  it('offers retry only for a pin that failed or needs checking', async () => {
    withPins([readyPin, postedPin]);
    renderPage();

    await screen.findByText('Does your Frenchie eat too fast?');

    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('can filter by the failed and needs-checking states', async () => {
    renderPage();
    await screen.findByText('Does your Frenchie eat too fast?');

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'needs_review' } });

    await waitFor(() => expect(listCalls().some((url) => url.includes('status=needs_review'))).toBe(true));
  });

  it('says when Pinterest is not connected and offers to connect', async () => {
    renderPage();

    expect(await screen.findByText(/Connect your Pinterest business account/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Connect Pinterest' })).toBeTruthy();
  });

  it('warns loudly when the connection was lost', async () => {
    withPins([readyPin], { ...notConnected, status: 'disconnected', last_error: 'Refresh token revoked' });
    renderPage();

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText(/automatic posting is paused/)).toBeTruthy();
    expect(screen.getByText('Refresh token revoked')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reconnect' })).toBeTruthy();
  });

  it('shows who is connected and the posting switches', async () => {
    withPins([readyPin], { ...notConnected, connected: true, status: 'connected', username: 'petposture' });
    renderPage();

    expect(await screen.findByText('Connected as @petposture')).toBeTruthy();
    expect((screen.getByLabelText(/Post due pins automatically/) as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText('Pins per day') as HTMLInputElement).value).toBe('3');
  });

  it('saves the posting switches', async () => {
    withPins([readyPin], { ...notConnected, connected: true, status: 'connected', username: 'petposture' });
    renderPage();

    fireEvent.click(await screen.findByLabelText(/Post due pins automatically/));
    fireEvent.change(screen.getByLabelText('Pins per day'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));

    await waitFor(() =>
      expect(mockedFetch).toHaveBeenCalledWith('/admin/pinterest/settings', {
        method: 'PUT',
        body: expect.objectContaining({ auto_publish: true, max_per_day: 2 }),
      }),
    );
  });

  it('without credentials on the server it explains and offers no connect button', async () => {
    withPins([readyPin], { ...notConnected, configured: false });
    renderPage();

    expect(await screen.findByText(/Pinterest is not set up on the server yet/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Connect Pinterest' })).toBeNull();
  });

  it('shows a small message, not an error page, when the server refuses to start the connection', async () => {
    mockedFetch.mockImplementation(async (url: string, init?: FetchApiOptions) => {
      if (url === '/admin/pinterest-pins/options') return { data: options };
      if (url === '/admin/pinterest/connection') return { data: notConnected };
      if (url === '/admin/pinterest/connect' && init?.method === 'POST') {
        throw Object.assign(new Error('Pinterest is not set up on the server (app id, secret and redirect address).'), { status: 422 });
      }
      return { data: [readyPin], meta: meta({ total: 1 }) };
    });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Connect Pinterest' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Pinterest is not set up on the server (app id, secret and redirect address).'));
    expect(screen.getByRole('button', { name: 'Connect Pinterest' })).toBeTruthy();
  });

  it('asks before disconnecting', async () => {
    withPins([readyPin], { ...notConnected, connected: true, status: 'connected', username: 'petposture' });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Disconnect' }));
    expect(mockedFetch).not.toHaveBeenCalledWith('/admin/pinterest/connection', { method: 'DELETE' });

    fireEvent.click(screen.getByRole('button', { name: 'Yes, disconnect' }));

    await waitFor(() => expect(mockedFetch).toHaveBeenCalledWith('/admin/pinterest/connection', { method: 'DELETE' }));
  });
});
