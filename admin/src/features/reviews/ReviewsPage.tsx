import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Review, ReviewStatus, useDeleteReview, useReviewProducts, useReviews, useUpdateReview } from './api';

const statuses: ReviewStatus[] = ['pending', 'approved', 'rejected'];

export function ReviewsPage({ canDelete }: { canDelete: boolean }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [productId, setProductId] = useState<number | undefined>();
  const [page, setPage] = useState(1);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [deletingReview, setDeletingReview] = useState<Review | null>(null);
  const reviewsQuery = useReviews({ status, productId, page });
  const productsQuery = useReviewProducts(productSearch);
  const updateMutation = useUpdateReview();
  const deleteMutation = useDeleteReview();

  useEffect(() => setPage(1), [status, productId]);

  function saveReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingReview) return;
    const values = new FormData(event.currentTarget);
    updateMutation.mutate({
      id: editingReview.id,
      payload: {
        status: values.get('status') as ReviewStatus,
        rating: Number(values.get('rating')),
        comment: String(values.get('comment') ?? ''),
        customer_name: String(values.get('customer_name') ?? ''),
      },
    }, {
      onSuccess: () => {
        toast.success(t('reviews.update_success'));
        setEditingReview(null);
      },
      onError: () => toast.error(t('reviews.update_error')),
    });
  }

  function confirmDelete() {
    if (!deletingReview) return;
    deleteMutation.mutate(deletingReview.id, {
      onSuccess: () => {
        toast.success(t('reviews.delete_success'));
        setDeletingReview(null);
      },
      onError: () => toast.error(t('reviews.delete_error')),
    });
  }

  const reviews = reviewsQuery.data?.data ?? [];
  const meta = reviewsQuery.data?.meta;

  return <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-slate-900">{t('reviews.title')}</h1>
      <p className="mt-1 text-sm text-slate-500">{t('reviews.subtitle')}</p>
    </div>

    <div className="flex flex-wrap gap-3 rounded-t-xl border border-b-0 border-slate-200 bg-white p-4">
      <select aria-label={t('reviews.status')} value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm">
        <option value="">{t('reviews.all_statuses')}</option>
        {statuses.map((value) => <option key={value} value={value}>{t(`reviews.status_${value}`)}</option>)}
      </select>
      <input aria-label={t('reviews.product_search')} value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder={t('reviews.product_search')} className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
      <select aria-label={t('reviews.product')} value={productId ?? ''} onChange={(event) => setProductId(event.target.value ? Number(event.target.value) : undefined)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm">
        <option value="">{t('reviews.all_products')}</option>
        {(productsQuery.data ?? []).map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
      </select>
    </div>

    <div className="overflow-hidden rounded-b-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto"><table className="w-full text-left"><thead className="border-b bg-slate-50"><tr>
        {['product', 'customer', 'rating', 'verified', 'status', 'created_at', 'actions'].map((key) => <th key={key} className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">{t(`reviews.column_${key}`)}</th>)}
      </tr></thead><tbody className="divide-y divide-slate-100">
        {reviewsQuery.isLoading ? <StateRow text={t('reviews.loading')} /> : reviewsQuery.isError ? <StateRow text={t('reviews.error')} error /> : !reviews.length ? <StateRow text={t('reviews.empty')} /> : reviews.map((review) => <tr key={review.id} className="hover:bg-slate-50">
          <td className="px-6 py-4 text-sm font-medium text-slate-900">{review.product?.name ?? t('reviews.no_product')}</td>
          <td className="px-6 py-4 text-sm text-slate-700">{review.customer_name}</td>
          <td className="px-6 py-4 text-sm text-amber-600">{'★'.repeat(review.rating)}</td>
          <td className="px-6 py-4 text-sm text-slate-700">{review.is_verified ? t('reviews.verified') : t('reviews.not_verified')}</td>
          <td className="px-6 py-4 text-sm"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{t(`reviews.status_${review.status}`)}</span></td>
          <td className="px-6 py-4 text-sm text-slate-500">{review.created_at ? new Date(review.created_at).toLocaleDateString() : t('reviews.no_date')}</td>
          <td className="space-x-3 px-6 py-4 text-sm"><button type="button" data-review-edit={review.id} className="text-primary hover:underline" onClick={() => setEditingReview(review)}>{t('reviews.edit')}</button>{canDelete && <button type="button" data-review-delete={review.id} className="text-red-600 hover:underline" onClick={() => setDeletingReview(review)}>{t('reviews.delete')}</button>}</td>
        </tr>)}
      </tbody></table></div>
      {meta && meta.last_page > 1 && <div className="flex items-center justify-between border-t bg-slate-50 px-6 py-4"><span className="text-sm text-slate-500">{t('reviews.page_of', { current: meta.current_page, last: meta.last_page })}</span><div className="flex gap-2"><Button variant="secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>{t('reviews.previous')}</Button><Button variant="secondary" disabled={page >= meta.last_page} onClick={() => setPage((current) => current + 1)}>{t('reviews.next')}</Button></div></div>}
    </div>

    {editingReview && <ReviewEditModal review={editingReview} saving={updateMutation.isPending} onClose={() => setEditingReview(null)} onSubmit={saveReview} />}
    {canDelete && deletingReview && <DeleteReviewModal review={deletingReview} deleting={deleteMutation.isPending} onClose={() => setDeletingReview(null)} onConfirm={confirmDelete} />}
  </div>;
}

function StateRow({ text, error = false }: { text: string; error?: boolean }) {
  return <tr><td colSpan={7} className={`px-6 py-12 text-center text-sm ${error ? 'text-red-600' : 'text-slate-500'}`}>{text}</td></tr>;
}

function ReviewEditModal({ review, saving, onClose, onSubmit }: { review: Review; saving: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const { t } = useTranslation();
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"><form onSubmit={onSubmit} className="w-full max-w-lg space-y-4 rounded-xl bg-white p-6 shadow-xl">
    <h2 className="text-xl font-bold text-slate-900">{t('reviews.edit_title')}</h2>
    <p className="text-sm text-slate-500">{t('reviews.product')}: {review.product?.name ?? t('reviews.no_product')}</p>
    <p className="text-sm text-slate-500">{t('reviews.verified')}: {review.is_verified ? t('reviews.verified') : t('reviews.not_verified')}</p>
    <label className="block text-sm font-medium text-slate-700">{t('reviews.customer_name')}<input name="customer_name" defaultValue={review.customer_name} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2" required /></label>
    <label className="block text-sm font-medium text-slate-700">{t('reviews.rating')}<input name="rating" type="number" min="1" max="5" defaultValue={review.rating} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2" required /></label>
    <label className="block text-sm font-medium text-slate-700">{t('reviews.status')}<select name="status" defaultValue={review.status} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2">{statuses.map((value) => <option key={value} value={value}>{t(`reviews.status_${value}`)}</option>)}</select></label>
    <label className="block text-sm font-medium text-slate-700">{t('reviews.comment')}<textarea name="comment" defaultValue={review.comment} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2" required /></label>
    <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={onClose}>{t('reviews.cancel')}</Button><Button type="submit" variant="primary" disabled={saving}>{saving ? t('reviews.saving') : t('reviews.save')}</Button></div>
  </form></div>;
}

function DeleteReviewModal({ review, deleting, onClose, onConfirm }: { review: Review; deleting: boolean; onClose: () => void; onConfirm: () => void }) {
  const { t } = useTranslation();
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"><div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"><h2 className="text-xl font-bold text-slate-900">{t('reviews.delete_title')}</h2><p className="mt-2 text-sm text-slate-500">{t('reviews.delete_warning', { name: review.customer_name })}</p><div className="mt-6 flex justify-end gap-3"><Button type="button" variant="secondary" onClick={onClose} disabled={deleting}>{t('reviews.cancel')}</Button><Button type="button" variant="danger" data-review-confirm-delete onClick={onConfirm} disabled={deleting}>{deleting ? t('reviews.deleting') : t('reviews.delete')}</Button></div></div></div>;
}
