import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { EyeIcon } from '@/components/ui/icons';
import { useReturnRequests } from './api';

export function ReturnRequestsListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const query = useReturnRequests({ status, page });
  const requests = query.data?.data ?? [];
  return <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <div className="mb-6"><h1 className="text-2xl font-bold text-slate-900">{t('return_requests.title')}</h1><p className="mt-1 text-sm text-slate-500">{t('return_requests.subtitle')}</p></div>
    <div className="rounded-t-xl border border-b-0 border-slate-200 bg-white p-4"><select aria-label={t('return_requests.status')} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="">{t('return_requests.all_statuses')}</option><option value="requested">{t('return_requests.status_requested')}</option><option value="approved">{t('return_requests.status_approved')}</option><option value="rejected">{t('return_requests.status_rejected')}</option><option value="completed">{t('return_requests.status_completed')}</option><option value="expired">{t('return_requests.status_expired')}</option><option value="waived">{t('return_requests.status_waived')}</option></select></div>
    <div className="overflow-hidden rounded-b-xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full"><thead className="border-b bg-slate-50"><tr>{['order_reference', 'reason', 'status', 'item_count', 'refund_amount', 'restocking_fee', 'requested_at'].map((key) => <th key={key} className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{t(`return_requests.column_${key}`)}</th>)}<th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{t('common.actions')}</th></tr></thead><tbody className="divide-y divide-slate-100">
      {query.isLoading ? <StateRow text={t('common.loading')} /> : query.isError ? <StateRow text={(query.error as Error).message} error /> : !requests.length ? <StateRow text={t('return_requests.empty')} /> : requests.map((request) => <tr key={request.id} className="hover:bg-slate-50"><td className="px-6 py-4"><button onClick={() => navigate(`/return-requests/${request.id}`)} className="font-semibold text-slate-900 hover:text-primary">{request.order_reference ?? '—'}</button></td><td className="px-6 py-4 text-sm">{request.reason}</td><td className="px-6 py-4 text-sm">{t(`return_requests.status_${request.status}`)}</td><td className="px-6 py-4 text-sm">{request.items.length}</td><td className="px-6 py-4 text-sm">{displayMoney(request.refund_amount)}</td><td className="px-6 py-4 text-sm">{displayMoney(request.restocking_fee)}</td><td className="px-6 py-4 text-sm text-slate-500">{request.requested_at ? new Date(request.requested_at).toLocaleDateString() : '—'}</td><td className="px-6 py-4"><button type="button" aria-label={t('common.view')} onClick={() => navigate(`/return-requests/${request.id}`)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-primary"><EyeIcon /></button></td></tr>)}
    </tbody></table></div>{query.data && query.data.meta.last_page > 1 && <div className="flex items-center justify-between border-t bg-slate-50 px-6 py-4"><span className="text-sm text-slate-500">{t('return_requests.page_of', { current: query.data.meta.current_page, last: query.data.meta.last_page })}</span><div className="flex gap-2"><Button variant="secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>{t('common.previous')}</Button><Button variant="secondary" disabled={page >= query.data.meta.last_page} onClick={() => setPage((current) => current + 1)}>{t('common.next')}</Button></div></div>}</div>
  </div>;
}
function displayMoney(value: number | null) { return value == null ? '—' : `$${value.toFixed(2)}`; }
function StateRow({ text, error = false }: { text: string; error?: boolean }) { return <tr><td colSpan={8} className={`px-6 py-12 text-center text-sm ${error ? 'text-red-600' : 'text-slate-500'}`}>{text}</td></tr>; }
