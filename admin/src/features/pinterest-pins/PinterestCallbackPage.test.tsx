import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import '@/i18n';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, fetchJson: vi.fn() };
});

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

import toast from 'react-hot-toast';
import { fetchJson } from '@/lib/api';
import { PinterestCallbackPage } from './PinterestCallbackPage';

const mockedFetch = vi.mocked(fetchJson);

function renderAt(search: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/system/integrations/pinterest/callback${search}`]}>
        <Routes>
          <Route path="/system/integrations/pinterest/callback" element={<PinterestCallbackPage />} />
          <Route path="/pinterest-pins" element={<p>The pins page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockedFetch.mockReset();
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
});

describe('PinterestCallbackPage', () => {
  it('hands the code and state to the server once, says so and goes back to the pins', async () => {
    mockedFetch.mockResolvedValue({ data: { username: 'petposture' } });

    renderAt('?code=the-code&state=the-state');

    expect(await screen.findByText('The pins page')).toBeTruthy();
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(mockedFetch).toHaveBeenCalledWith('/admin/pinterest/callback', { method: 'POST', body: { code: 'the-code', state: 'the-state' } });
    expect(toast.success).toHaveBeenCalledWith('Pinterest connected as @petposture.');
  });

  it('reports the refusal and goes back to the pins', async () => {
    mockedFetch.mockRejectedValue(new Error('Pinterest refused the connection: Code expired'));

    renderAt('?code=old&state=s');

    expect(await screen.findByText('The pins page')).toBeTruthy();
    expect(toast.error).toHaveBeenCalledWith('Pinterest refused the connection: Code expired');
  });

  it('says so when the owner did not allow it on Pinterest, without calling the server', async () => {
    renderAt('?error=access_denied&state=s');

    expect(await screen.findByText('The pins page')).toBeTruthy();
    expect(toast.error).toHaveBeenCalledWith('The connection was not allowed on Pinterest.');
    await waitFor(() => expect(mockedFetch).not.toHaveBeenCalled());
  });

  it('says so when opened without an answer from Pinterest', async () => {
    renderAt('');

    expect(await screen.findByText('The pins page')).toBeTruthy();
    expect(toast.error).toHaveBeenCalledWith('This page was opened without an answer from Pinterest. Try connecting again.');
    expect(mockedFetch).not.toHaveBeenCalled();
  });
});
