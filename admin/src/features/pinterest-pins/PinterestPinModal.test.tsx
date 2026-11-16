import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@/i18n';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, fetchJson: vi.fn() };
});

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

// The real library opens a browsable grid; a stub that "picks" a known image is enough here.
vi.mock('@/components/ui/media-library-modal', () => ({
  MediaLibraryModal: ({ open, onSelect }: { open: boolean; onSelect: (media: { id: string; url: string }) => void }) =>
    open ? <button type="button" onClick={() => onSelect({ id: '12', url: 'https://api.test/storage/media/pin.png' })}>Pick the stub image</button> : null,
}));

import toast from 'react-hot-toast';
import { fetchJson, type FetchApiOptions } from '@/lib/api';
import { PinterestPinModal } from './PinterestPinModal';
import type { PinterestPin } from './api';

const options = {
  boards: ['Dog Feeding', 'French Bulldog Tips'],
  posts: [
    { id: 5, title: 'Tilted Bowl vs Slow Feeder', slug: 'tilted-bowl-vs-slow-feeder', url: 'https://petposture.com/blog/tilted-bowl-vs-slow-feeder' },
    { id: 6, title: 'Best Harness for a Corgi', slug: 'best-harness-for-a-corgi', url: 'https://petposture.com/blog/best-harness-for-a-corgi' },
  ],
};

const existing: PinterestPin = {
  id: 7,
  post_id: 5,
  post: { id: 5, title: 'Tilted Bowl vs Slow Feeder', slug: 'tilted-bowl-vs-slow-feeder' },
  media_id: '12',
  image: 'media/pin.png',
  image_url: 'https://api.test/storage/media/pin.png',
  image_width: 1000,
  image_height: 1500,
  title: 'Does your Frenchie eat too fast?',
  description: 'A tilted bowl can help.',
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
  created_at: null,
  updated_at: null,
};

const connection = (overrides = {}) => ({
  configured: true,
  connected: false,
  status: 'not_connected',
  username: null,
  last_error: null,
  refresh_expires_at: null,
  settings: { auto_publish: false, max_per_day: 3, min_gap_minutes: 180, window_start: '08:00', window_end: '21:00', timezone: 'America/New_York' },
  recent_errors: [],
  ...overrides,
});

const pinterestBoards = [
  { id: '111', name: 'Feeding' },
  { id: '222', name: 'French Bulldog Tips' },
];

const mockedFetch = vi.mocked(fetchJson);

function renderModal(props: Partial<React.ComponentProps<typeof PinterestPinModal>> = {}) {
  const onClose = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <QueryClientProvider client={queryClient}>
      <PinterestPinModal open pin={null} onClose={onClose} {...props} />
    </QueryClientProvider>,
  );

  return { onClose };
}

const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;

async function pickImage() {
  fireEvent.click(await screen.findByRole('button', { name: /choose image/i }));
  fireEvent.click(await screen.findByText('Pick the stub image'));
}

beforeEach(() => {
  mockedFetch.mockReset();
  vi.mocked(toast.success).mockReset();
  mockedFetch.mockImplementation(async (url: string, init?: FetchApiOptions) => {
    if (url === '/admin/pinterest-pins/options') return { data: options };
    if (url === '/admin/pinterest/connection') return { data: connection() };
    if (init?.method === 'POST') return { data: { ...existing, id: 8 } };
    if (init?.method === 'PUT') return { data: existing };
    return null;
  });
});

describe('PinterestPinModal fields', () => {
  it('shows a new pin with empty counters', async () => {
    renderModal();

    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.getByText('New pin')).toBeTruthy();
    expect(screen.getByText('0/100')).toBeTruthy();
    expect(screen.getByText('0/500')).toBeTruthy();
  });

  it('counts the characters of the title and the description as they are typed', async () => {
    renderModal();
    await screen.findByRole('dialog');

    fireEvent.change(field('Title'), { target: { value: 'Does your Frenchie eat too fast?' } });
    fireEvent.change(field('Description'), { target: { value: 'Short.' } });

    expect(screen.getByText('32/100')).toBeTruthy();
    expect(screen.getByText('6/500')).toBeTruthy();
  });

  it('turns the counter red and blocks saving when the title is over 100 characters', async () => {
    renderModal();
    await screen.findByRole('dialog');
    await pickImage();

    fireEvent.change(field('Title'), { target: { value: 't'.repeat(101) } });
    fireEvent.change(field('Description'), { target: { value: 'Some description.' } });
    fireEvent.change(field('Destination link'), { target: { value: 'https://petposture.com/blog/x' } });

    expect(screen.getByText('101/100').className).toContain('text-red');

    fireEvent.click(screen.getByRole('button', { name: 'Save pin' }));

    expect(await screen.findByText('The title can be at most 100 characters.')).toBeTruthy();
    expect(mockedFetch).not.toHaveBeenCalledWith('/admin/pinterest-pins', expect.anything());
  });

  it('suggests the boards used before', async () => {
    renderModal();
    await screen.findByRole('dialog');

    await waitFor(() => {
      const list = document.getElementById(field('Board').getAttribute('list') ?? '');
      expect(Array.from(list?.querySelectorAll('option') ?? []).map((option) => option.getAttribute('value'))).toEqual([
        'Dog Feeding',
        'French Bulldog Tips',
      ]);
    });
  });
});

describe('PinterestPinModal post and link', () => {
  it('fills the destination link with the URL of the chosen post', async () => {
    renderModal();
    await screen.findByRole('dialog');
    await screen.findByRole('option', { name: 'Tilted Bowl vs Slow Feeder' });

    fireEvent.change(field('Blog post'), { target: { value: '5' } });

    expect(field('Destination link').value).toBe('https://petposture.com/blog/tilted-bowl-vs-slow-feeder');
  });

  it('keeps the link editable by hand after it was filled in', async () => {
    renderModal();
    await screen.findByRole('dialog');
    await screen.findByRole('option', { name: 'Tilted Bowl vs Slow Feeder' });
    fireEvent.change(field('Blog post'), { target: { value: '5' } });

    fireEvent.change(field('Destination link'), { target: { value: 'https://petposture.com/picks/necoichi-tilted-elevated-bowl' } });

    expect(field('Destination link').value).toBe('https://petposture.com/picks/necoichi-tilted-elevated-bowl');
  });

  it('fills the link again with the URL of another post when the post is changed', async () => {
    renderModal();
    await screen.findByRole('dialog');
    await screen.findByRole('option', { name: 'Best Harness for a Corgi' });

    fireEvent.change(field('Blog post'), { target: { value: '5' } });
    fireEvent.change(field('Blog post'), { target: { value: '6' } });

    expect(field('Destination link').value).toBe('https://petposture.com/blog/best-harness-for-a-corgi');
  });

  it('leaves the link alone when the post is cleared', async () => {
    renderModal();
    await screen.findByRole('dialog');
    await screen.findByRole('option', { name: 'Tilted Bowl vs Slow Feeder' });
    fireEvent.change(field('Blog post'), { target: { value: '5' } });

    fireEvent.change(field('Blog post'), { target: { value: '' } });

    expect(field('Destination link').value).toBe('https://petposture.com/blog/tilted-bowl-vs-slow-feeder');
  });
});

describe('PinterestPinModal image', () => {
  it('shows an empty 2:3 frame until an image is chosen', async () => {
    renderModal();

    const frame = await screen.findByTestId('pin-image-frame');
    expect(frame.className).toContain('aspect-[2/3]');
    expect(frame.querySelector('img')).toBeNull();
  });

  it('shows the chosen image in the 2:3 frame', async () => {
    renderModal();
    await screen.findByRole('dialog');

    await pickImage();

    const image = screen.getByTestId('pin-image-frame').querySelector('img');
    expect(image?.getAttribute('src')).toBe('https://api.test/storage/media/pin.png');
    expect(screen.getByRole('button', { name: /change image/i })).toBeTruthy();
  });

  it('warns when the chosen image is not 2:3, and says nothing when it is', async () => {
    renderModal();
    await screen.findByRole('dialog');
    await pickImage();
    const image = screen.getByTestId('pin-image-frame').querySelector('img') as HTMLImageElement;

    Object.defineProperty(image, 'naturalWidth', { value: 1000, configurable: true });
    Object.defineProperty(image, 'naturalHeight', { value: 1000, configurable: true });
    fireEvent.load(image);
    expect(await screen.findByText(/This image is not 2:3/)).toBeTruthy();

    Object.defineProperty(image, 'naturalHeight', { value: 1500, configurable: true });
    fireEvent.load(image);
    await waitFor(() => expect(screen.queryByText(/This image is not 2:3/)).toBeNull());
  });
});

describe('PinterestPinModal saving', () => {
  it('asks for an image before saving', async () => {
    renderModal();
    await screen.findByRole('dialog');
    fireEvent.change(field('Title'), { target: { value: 'A title' } });
    fireEvent.change(field('Description'), { target: { value: 'A description' } });
    fireEvent.change(field('Destination link'), { target: { value: 'https://petposture.com/blog/x' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save pin' }));

    expect(await screen.findByText('Choose an image for the pin.')).toBeTruthy();
    expect(mockedFetch).not.toHaveBeenCalledWith('/admin/pinterest-pins', expect.anything());
  });

  it('creates the pin with what was entered, closes and says so', async () => {
    const { onClose } = renderModal();
    await screen.findByRole('dialog');
    await screen.findByRole('option', { name: 'Tilted Bowl vs Slow Feeder' });
    await pickImage();
    fireEvent.change(field('Blog post'), { target: { value: '5' } });
    fireEvent.change(field('Title'), { target: { value: '  Does your Frenchie eat too fast?  ' } });
    fireEvent.change(field('Description'), { target: { value: 'A tilted bowl can help.' } });
    fireEvent.change(field('Board'), { target: { value: 'French Bulldog Tips' } });
    fireEvent.change(field('Scheduled date'), { target: { value: '2026-11-25' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save pin' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mockedFetch).toHaveBeenCalledWith('/admin/pinterest-pins', {
      method: 'POST',
      body: {
        media_id: 12,
        post_id: 5,
        title: 'Does your Frenchie eat too fast?',
        description: 'A tilted bowl can help.',
        destination_url: 'https://petposture.com/blog/tilted-bowl-vs-slow-feeder',
        board: 'French Bulldog Tips',
        pinterest_board_id: null,
        status: 'ready',
        scheduled_date: '2026-11-25',
      },
    });
    expect(toast.success).toHaveBeenCalledWith('Pin created');
  });

  it('shows what the server refused next to the field', async () => {
    mockedFetch.mockImplementation(async (url: string, init?: FetchApiOptions) => {
      if (url === '/admin/pinterest-pins/options') return { data: options };
      if (init?.method === 'POST') {
        throw Object.assign(new Error('The given data was invalid.'), {
          status: 422,
          data: { errors: { destination_url: ['The destination url field must be a valid URL.'] } },
        });
      }
      return null;
    });
    const { onClose } = renderModal();
    await screen.findByRole('dialog');
    await pickImage();
    fireEvent.change(field('Title'), { target: { value: 'A title' } });
    fireEvent.change(field('Description'), { target: { value: 'A description' } });
    fireEvent.change(field('Destination link'), { target: { value: 'https://petposture.com/blog/x' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save pin' }));

    expect(await screen.findByText('The destination url field must be a valid URL.')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('PinterestPinModal editing', () => {
  it('opens a pin with its values and its image', async () => {
    renderModal({ pin: existing });

    expect(await screen.findByText('Edit pin')).toBeTruthy();
    expect(field('Title').value).toBe('Does your Frenchie eat too fast?');
    expect(field('Description').value).toBe('A tilted bowl can help.');
    expect(field('Destination link').value).toBe('https://petposture.com/blog/tilted-bowl-vs-slow-feeder');
    expect(field('Board').value).toBe('French Bulldog Tips');
    expect(field('Scheduled date').value).toBe('2026-11-25');
    expect(screen.getByTestId('pin-image-frame').querySelector('img')?.getAttribute('src')).toBe(existing.image_url);
    expect(screen.getByText('32/100')).toBeTruthy();
  });

  it('saves the changes to that pin', async () => {
    const { onClose } = renderModal({ pin: existing });
    await screen.findByText('Edit pin');

    fireEvent.change(field('Title'), { target: { value: 'New title' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save pin' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mockedFetch).toHaveBeenCalledWith(
      '/admin/pinterest-pins/7',
      expect.objectContaining({ method: 'PUT', body: expect.objectContaining({ title: 'New title', media_id: 12 }) }),
    );
    expect(toast.success).toHaveBeenCalledWith('Pin updated');
  });
});

describe('PinterestPinModal with Pinterest connected', () => {
  function connectedMock() {
    mockedFetch.mockImplementation(async (url: string, init?: FetchApiOptions) => {
      if (url === '/admin/pinterest-pins/options') return { data: options };
      if (url === '/admin/pinterest/connection') return { data: connection({ connected: true, status: 'connected', username: 'petposture' }) };
      if (url === '/admin/pinterest/boards') return { data: pinterestBoards };
      if (init?.method === 'POST') return { data: { ...existing, id: 8 } };
      if (init?.method === 'PUT') return { data: existing };
      return null;
    });
  }

  it('offers the boards of the connected account instead of free text', async () => {
    connectedMock();
    renderModal();

    expect(await screen.findByRole('option', { name: 'Feeding' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'French Bulldog Tips' })).toBeTruthy();
    expect((screen.getByLabelText('Board') as HTMLElement).tagName).toBe('SELECT');
  });

  it('sends the chosen board id along with its name', async () => {
    connectedMock();
    const { onClose } = renderModal();
    await screen.findByRole('option', { name: 'Feeding' });
    await pickImage();
    fireEvent.change(field('Title'), { target: { value: 'A title' } });
    fireEvent.change(field('Description'), { target: { value: 'A description' } });
    fireEvent.change(field('Destination link'), { target: { value: 'https://petposture.com/blog/x' } });
    fireEvent.change(field('Board'), { target: { value: '222' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save pin' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mockedFetch).toHaveBeenCalledWith(
      '/admin/pinterest-pins',
      expect.objectContaining({ method: 'POST', body: expect.objectContaining({ board: 'French Bulldog Tips', pinterest_board_id: '222' }) }),
    );
  });

  it('keeps the typed board field when Pinterest is not connected', async () => {
    renderModal();
    await screen.findByRole('dialog');

    expect((screen.getByLabelText('Board') as HTMLElement).tagName).toBe('INPUT');
  });

  it('does not change the status of a pin that needs checking when only its text is edited', async () => {
    connectedMock();
    const { onClose } = renderModal({ pin: { ...existing, status: 'needs_review', last_error: 'unsure' } });
    await screen.findByText('Edit pin');

    fireEvent.change(field('Title'), { target: { value: 'New title' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save pin' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const call = mockedFetch.mock.calls.find(([url, init]) => url === '/admin/pinterest-pins/7' && (init as FetchApiOptions)?.method === 'PUT');
    expect((call?.[1] as { body: Record<string, unknown> }).body).not.toHaveProperty('status');
  });
});
