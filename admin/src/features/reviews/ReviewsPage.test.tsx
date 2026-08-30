import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { useReviews, useReviewProducts, useUpdateReview, useDeleteReview, toast } = vi.hoisted(() => ({
  useReviews: vi.fn(),
  useReviewProducts: vi.fn(),
  useUpdateReview: vi.fn(),
  useDeleteReview: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('react-hot-toast', () => ({ default: toast }));
vi.mock('./api', () => ({ useReviews, useReviewProducts, useUpdateReview, useDeleteReview }));

import { ReviewsPage } from './ReviewsPage';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const review = {
  id: 4,
  product: { id: 12, name: 'Support Bed' },
  customer_name: 'Taylor Customer',
  customer_email: 'taylor@example.com',
  rating: 5,
  comment: 'Helpful review.',
  is_verified: true,
  status: 'pending',
  created_at: '2026-08-30T12:00:00.000Z',
  updated_at: '2026-08-30T12:00:00.000Z',
};

function renderReviews(canDelete = true) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => root.render(createElement(QueryClientProvider, { client }, createElement(ReviewsPage, { canDelete }))));
  return { host, root };
}

function change(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')?.set;
  setter?.call(element, value);
  act(() => element.dispatchEvent(new Event('change', { bubbles: true })));
}

describe('ReviewsPage moderation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useReviews.mockReturnValue({ data: { data: [review], meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 } }, isLoading: false, isError: false });
    useReviewProducts.mockReturnValue({ data: [{ id: 12, name: 'Support Bed' }], isLoading: false });
    useUpdateReview.mockReturnValue({ mutate: vi.fn(), isPending: false });
    useDeleteReview.mockReturnValue({ mutate: vi.fn(), isPending: false });
  });

  it('uses the review lookup results for a product filter', () => {
    const { host, root } = renderReviews();
    const productFilter = host.querySelector('select[aria-label="reviews.product"]') as HTMLSelectElement;

    expect(productFilter).not.toBeNull();
    expect(productFilter.textContent).toContain('Support Bed');
    expect(useReviewProducts).toHaveBeenCalled();

    act(() => root.unmount());
    host.remove();
  });

  it('searches review products and sends the selected product ID with the reviews query', () => {
    const { host, root } = renderReviews();
    const productSearch = host.querySelector('input[aria-label="reviews.product_search"]') as HTMLInputElement;
    const productFilter = host.querySelector('select[aria-label="reviews.product"]') as HTMLSelectElement;

    change(productSearch, 'support');
    expect(useReviewProducts).toHaveBeenLastCalledWith('support');

    change(productFilter, '12');
    expect(useReviews).toHaveBeenLastCalledWith({ status: '', productId: 12, page: 1 });

    act(() => root.unmount());
    host.remove();
  });

  it('sends the selected pagination page with the reviews query', () => {
    useReviews.mockReturnValue({ data: { data: [review], meta: { current_page: 1, last_page: 2, per_page: 15, total: 30 } }, isLoading: false, isError: false });
    const { host, root } = renderReviews();

    const nextButton = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'reviews.next') as HTMLButtonElement;
    act(() => nextButton.click());
    expect(useReviews).toHaveBeenLastCalledWith({ status: '', productId: undefined, page: 2 });

    act(() => root.unmount());
    host.remove();
  });

  it('shows the localized generic list error instead of backend error details', () => {
    useReviews.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: new Error('Database connection failed') });
    const { host, root } = renderReviews();

    expect(host.textContent).toContain('reviews.error');
    expect(host.textContent).not.toContain('Database connection failed');

    act(() => root.unmount());
    host.remove();
  });

  it('edits only moderation fields and displays product and verified evidence as read-only', () => {
    const mutate = vi.fn();
    useUpdateReview.mockReturnValue({ mutate, isPending: false });
    const { host, root } = renderReviews();

    const reviewRow = Array.from(host.querySelectorAll('tbody tr')).find((row) => row.textContent?.includes('Taylor Customer'))!;
    const actionsButton = Array.from(reviewRow.querySelectorAll('button')).find((button) => button.querySelector('svg circle[cx="12"]'));
    expect(actionsButton).toBeTruthy();
    act(() => actionsButton?.click());
    act(() => (host.querySelector('button[data-review-edit="4"]') as HTMLButtonElement).click());
    expect(host.textContent).toContain('Support Bed');
    expect(host.textContent).toContain('reviews.verified');
    expect(host.querySelector('input[name="product"]')).toBeNull();
    expect(host.querySelector('input[name="is_verified"]')).toBeNull();
    expect(host.textContent).not.toContain('reviews.create');

    change(host.querySelector('select[name="status"]') as HTMLSelectElement, 'approved');
    change(host.querySelector('input[name="rating"]') as HTMLInputElement, '4');
    change(host.querySelector('textarea[name="comment"]') as HTMLTextAreaElement, 'Moderated comment.');
    change(host.querySelector('input[name="customer_name"]') as HTMLInputElement, 'Moderated customer');
    act(() => (host.querySelector('button[type="submit"]') as HTMLButtonElement).click());

    expect(mutate).toHaveBeenCalledWith({
      id: 4,
      payload: { status: 'approved', rating: 4, comment: 'Moderated comment.', customer_name: 'Moderated customer' },
    }, expect.any(Object));

    act(() => root.unmount());
    host.remove();
  });

  it('shows the localized generic update error instead of backend error details', () => {
    const mutate = vi.fn((_request, options) => options.onError(new Error('Validation trace: internal-only')));
    useUpdateReview.mockReturnValue({ mutate, isPending: false });
    const { host, root } = renderReviews();

    const reviewRow = Array.from(host.querySelectorAll('tbody tr')).find((row) => row.textContent?.includes('Taylor Customer'))!;
    const actionsButton = Array.from(reviewRow.querySelectorAll('button')).find((button) => button.querySelector('svg circle[cx="12"]'));
    expect(actionsButton).toBeTruthy();
    act(() => actionsButton?.click());
    act(() => (host.querySelector('button[data-review-edit="4"]') as HTMLButtonElement).click());
    act(() => (host.querySelector('button[type="submit"]') as HTMLButtonElement).click());

    expect(toast.error).toHaveBeenCalledWith('reviews.update_error');
    expect(toast.error).not.toHaveBeenCalledWith('Validation trace: internal-only');

    act(() => root.unmount());
    host.remove();
  });

  it('keeps the actions menu but hides its delete item when deletion is not permitted', () => {
    const { host, root } = renderReviews(false);
    const reviewRow = Array.from(host.querySelectorAll('tbody tr')).find((row) => row.textContent?.includes('Taylor Customer'))!;
    const actionsButton = Array.from(reviewRow.querySelectorAll('button')).find((button) => button.querySelector('svg circle[cx="12"]'));
    expect(actionsButton).toBeTruthy();
    act(() => actionsButton?.click());

    expect(host.querySelector('[data-review-edit="4"]')).not.toBeNull();
    expect(host.querySelector('[data-review-delete="4"]')).toBeNull();

    act(() => root.unmount());
    host.remove();
  });

  it('keeps a delete confirmation open and shows a generic error when its request fails', () => {
    const mutate = vi.fn((_id, options) => options.onError(new Error('Delete failed: internal-only')));
    useDeleteReview.mockReturnValue({ mutate, isPending: false });
    const { host, root } = renderReviews(true);

    const reviewRow = Array.from(host.querySelectorAll('tbody tr')).find((row) => row.textContent?.includes('Taylor Customer'))!;
    const actionsButton = Array.from(reviewRow.querySelectorAll('button')).find((button) => button.querySelector('svg circle[cx="12"]'));
    expect(actionsButton).toBeTruthy();
    act(() => actionsButton?.click());
    act(() => (host.querySelector('[data-review-delete="4"]') as HTMLButtonElement).click());
    expect(host.textContent).toContain('reviews.delete_title');
    act(() => (host.querySelector('[data-review-confirm-delete]') as HTMLButtonElement).click());

    expect(mutate).toHaveBeenCalledWith(4, expect.any(Object));
    expect(host.textContent).toContain('reviews.delete_title');
    expect(toast.error).toHaveBeenCalledWith('reviews.delete_error');
    expect(toast.error).not.toHaveBeenCalledWith('Delete failed: internal-only');

    act(() => root.unmount());
    host.remove();
  });
});
