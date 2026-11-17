import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  preview: vi.fn(),
  run: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, values?: Record<string, unknown>) => (values ? `${key} ${JSON.stringify(values)}` : key) }),
}));
vi.mock('./api', () => ({ previewProductImport: mocks.preview, importProducts: mocks.run }));

import { ProductImportModal } from './ProductImportModal';

const row = { row: 2, name: 'KONG Puppy Chew Dog Toy', variant: 'Pink, Small', price: '7.46', status: 'create', reasons: [], warnings: [], photos: [{ slot: 1, source: 'library', label: 'kong-puppy.jpg', alt: 'KONG' }] };

async function mount(open = true) {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(createElement(QueryClientProvider, { client: new QueryClient() }, createElement(ProductImportModal, { open, onClose: vi.fn() }))));
  return { container, root };
}

async function choose(container: HTMLElement) {
  const input = container.querySelector('input[type=file]') as HTMLInputElement;
  const file = new File(['x'], 'picks.xlsx');
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); });
  return file;
}

describe('ProductImportModal', () => {
  afterEach(() => { document.body.innerHTML = ''; mocks.preview.mockReset(); mocks.run.mockReset(); });

  it('renders nothing while closed', async () => {
    const { container } = await mount(false);
    expect(container.innerHTML).toBe('');
  });

  it('shows the preview first and only imports after the user confirms', async () => {
    mocks.preview.mockResolvedValue({ summary: { create: 1, skipped_duplicate: 0, error: 0 }, rows: [row] });
    const { container } = await mount();

    const file = await choose(container);

    expect(mocks.preview).toHaveBeenCalledWith(file);
    expect(mocks.run).not.toHaveBeenCalled();
    expect(container.textContent).toContain('KONG Puppy Chew Dog Toy');
    expect(container.textContent).toContain('products.import_status_create');

    mocks.run.mockResolvedValue({ created: [{ row: 2, name: 'KONG Puppy Chew Dog Toy', id: 9, slug: 'kong' }], skipped: [], failed: [], photo_warnings: [] });
    const confirm = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('products.import_confirm'))!;
    await act(async () => { confirm.click(); });

    expect(mocks.run).toHaveBeenCalledWith(file);
    expect(container.textContent).toContain('products.import_summary_done');
  });

  it('cannot be confirmed when no row can be created, and shows why a row was flagged', async () => {
    mocks.preview.mockResolvedValue({ summary: { create: 0, skipped_duplicate: 0, error: 1 }, rows: [{ ...row, status: 'error', reasons: ['Chewy URL is missing or is not a web address (http or https).'] }] });
    const { container } = await mount();

    await choose(container);

    expect(container.textContent).toContain('Chewy URL is missing');
    const confirm = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('products.import_confirm')) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
  });

  it('shows the server message when the file is rejected', async () => {
    mocks.preview.mockRejectedValue(Object.assign(new Error('Request failed'), { data: { errors: { file: ['The file has no "price" column in its first row.'] } } }));
    const { container } = await mount();

    await choose(container);

    expect(container.querySelector('[role=alert]')?.textContent).toContain('no "price" column');
  });
});
