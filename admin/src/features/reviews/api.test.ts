import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchJson } = vi.hoisted(() => ({ fetchJson: vi.fn() }));
vi.mock('@/lib/api', () => ({ fetchJson }));

import {
  buildReviewsQuery,
  deleteReview,
  fetchReview,
  fetchReviewProducts,
  fetchReviews,
  updateReview,
} from './api';

describe('reviews API', () => {
  beforeEach(() => fetchJson.mockReset());

  it('builds the filtered reviews endpoint without empty query values', () => {
    expect(buildReviewsQuery({ status: 'pending', productId: 12, page: 3 })).toBe('/admin/reviews?status=pending&product_id=12&page=3');
    expect(buildReviewsQuery({ status: '', productId: undefined, page: 1 })).toBe('/admin/reviews?page=1');
  });

  it('uses the review-only product lookup endpoint', async () => {
    fetchJson.mockResolvedValue({ data: [{ id: 12, name: 'Support Bed' }] });

    await expect(fetchReviewProducts('support bed')).resolves.toEqual([{ id: 12, name: 'Support Bed' }]);
    expect(fetchJson).toHaveBeenCalledWith('/admin/reviews/products?search=support+bed');
  });

  it('uses only the moderation allow-list for updates', async () => {
    fetchJson.mockResolvedValue({ data: { id: 4 } });

    await updateReview(4, {
      status: 'approved',
      rating: 4,
      comment: 'Helpful after moderation.',
      customer_name: 'Updated customer',
    });

    expect(fetchJson).toHaveBeenCalledWith('/admin/reviews/4', {
      method: 'PATCH',
      body: {
        status: 'approved',
        rating: 4,
        comment: 'Helpful after moderation.',
        customer_name: 'Updated customer',
      },
    });
  });

  it('gets details and deletes using the review endpoints', async () => {
    fetchJson.mockResolvedValueOnce({ data: { id: 4 } }).mockResolvedValueOnce(null);

    await expect(fetchReview(4)).resolves.toEqual({ id: 4 });
    await deleteReview(4);

    expect(fetchJson).toHaveBeenNthCalledWith(1, '/admin/reviews/4');
    expect(fetchJson).toHaveBeenNthCalledWith(2, '/admin/reviews/4', { method: 'DELETE' });
  });

  it('loads filtered review pages through the list endpoint', async () => {
    const response = { data: [], meta: { current_page: 2, last_page: 4, per_page: 15, total: 60 } };
    fetchJson.mockResolvedValue(response);

    await expect(fetchReviews({ status: 'rejected', productId: 8, page: 2 })).resolves.toEqual(response);
    expect(fetchJson).toHaveBeenCalledWith('/admin/reviews?status=rejected&product_id=8&page=2');
  });
});
